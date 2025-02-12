// eslint-disable-next-line no-undef
const { storage, browserAction, runtime, webRequest } = chrome;

const FEC = {
  COLORS: {
    ON: '#1890ff',
    OFF: '#bfbfbf'
  },
  BADGE: {
    OFF: 'OFF'
  },
  REG: {
    CHROME_EXTENSION: /^chrome-extension:\/\//i,
    FORWARD: /\\|\[|]|\(|\)|\*|\$|\^/i
  },
  UrlType: {
    REG: 'reg',
    STRING: 'string'
  },
  CHROME: {
    ALL_URLS: '<all_urls>',
    BLOCKING: 'blocking',
    REQUEST_HEADERS: 'requestHeaders',
    RESPONSE_HEADERS: 'responseHeaders',
    EXTRA_HEADERS: 'extraHeaders'
  },
  CORS: {
    'defautl_methods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
    'overwrite-origin': true,
    'methods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
    'remove-x-frame': true,
    'allow-credentials': true,
    // Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-Requested-With, X-Referer
    'allow-headers-value': '*',
    'allow-origin-value': '*',
    'expose-headers-value': '*',
    'allow-headers': true,
    'unblock-initiator': true
  }
};

// 合并所有请求相关的 Map
const feProxyStore = new Map();

class FeProxy {
  constructor() {
    this.feProxyEnable = false;
    this.feProxyCorsEnable = false;
    this.feProxyLoggerEnable = false;
    this.feProxyGroups = [];
  }

  init(storage) {
    storage.local.get([
      'feProxyEnable',
      'feProxyCorsEnable',
      'feProxyLoggerEnable',
      'feProxyGroups'
    ], (result) => {
      Object.assign(this, {
        feProxyEnable: result.feProxyEnable || false,
        feProxyCorsEnable: result.feProxyCorsEnable || false,
        feProxyLoggerEnable: result.feProxyLoggerEnable || false,
        feProxyGroups: result.feProxyGroups || []
      });
      this.updateIcon();
    });
  }

  updateIcon() {
    const badgeText = this.feProxyEnable ? 
      this._getEnableRuleSize().toString() : 
      FEC.BADGE.OFF;
    
    const color = this.feProxyEnable ? 
      FEC.COLORS.ON : 
      FEC.COLORS.OFF;

    browserAction.setBadgeText({ text: badgeText });
    browserAction.setBadgeBackgroundColor({ color });
  }

  _getEnableRuleSize() {
    return this.feProxyGroups.reduce((size, group) => {
      if (group?.enable && group.rules) {
        return size + group.rules.filter(rule => 
          rule.enable && rule.url && rule.forwardUrl
        ).length;
      }
      return size;
    }, 0);
  }

  _getMatchRule(tabId, originUrl) {
    if (!this.feProxyEnable) return null;

    try {
      for (const group of this.feProxyGroups) {
        if (!group?.enable || !group.rules) continue;

        for (const rule of group.rules) {
          if (!rule.enable || !rule.url || !rule.forwardUrl) continue;

          const matched = this._matchUrl(originUrl, rule.url);
          if (!matched) continue;

          const proxyUrl = this._buildProxyUrl(originUrl, rule.url, rule.forwardUrl, matched);
          
          // 存储请求相关数据
          // 如果出现 CORS 预检，details.requestId 会变化，而 details.tabId 不会，所以这里使用 tabId
          feProxyStore.set(tabId, {
            authorization: group.authorization?.trim(),
            proxyUrl,
            cors: true
          });

          return { url: rule.url, forwardUrl: rule.forwardUrl, proxyUrl };
        }
      }
    } catch (error) {
      console.error('Error in getMatchRule:', error);
    }
    return null;
  }

  _matchUrl(originUrl, ruleUrl) {
    try {
      if (FEC.REG.FORWARD.test(ruleUrl)) {
        const regex = new RegExp(ruleUrl.replace('??', '\\?\\?'), 'i');
        return regex.test(originUrl) ? FEC.UrlType.REG : false;
      }
      return originUrl.includes(ruleUrl) ? FEC.UrlType.STRING : false;
    } catch (error) {
      console.error('Error in matchUrl:', error);
      return false;
    }
  }

  _buildProxyUrl(originUrl, ruleUrl, ruleForwardUrl, matchType) {
    if (matchType === FEC.UrlType.REG) {
      const r = new RegExp(ruleUrl.replace('??', '\\?\\?'), 'i');
      return originUrl.replace(r, ruleForwardUrl).trim();
    }
    return originUrl.split(ruleUrl).join(ruleForwardUrl).trim();
  }

  onBeforeRequestCallback(details) {
    let originUrl = details.url;
    
    // 检查是否为 chrome 扩展请求
    if (FEC.REG.CHROME_EXTENSION.test(originUrl)) {
      return {};
    }

    try {
      const rule = this._getMatchRule(details.tabId, originUrl);
      if (!rule) {
        return {};
      }

      const proxyUrl = rule.proxyUrl;
      if (proxyUrl === originUrl) {
        return {};
      }
      
      // 记录日志
      if (this.feProxyLoggerEnable) {
        console.log('%o.转发 ---> 原始请求: %o, 转发请求: %o', details.tabId, originUrl, proxyUrl);
      }

      return { redirectUrl: proxyUrl };
    } catch (error) {
      console.error('Error in onBeforeRequestCallback:', error);
      return {};
    }
  }

  onBeforeSendHeadersCallback(details) {
    if (!this.feProxyEnable) {
      return {};
    }
    const { url, requestHeaders, tabId } = details;
    if (FEC.REG.CHROME_EXTENSION.test(url)) {
      return {};
    }

    // 处理授权信息
    const authorizationHeader = requestHeaders.find(({name}) => name.toLowerCase() === 'authorization');
    if (authorizationHeader) {
      return {};
    }
    const storedData = feProxyStore.get(tabId) || {};
    if (storedData?.authorization) {
      // 记录日志
      if (this.feProxyLoggerEnable) {
        console.log('%o.请求头 ---> Authorization: %o', tabId, storedData.authorization);
      }
      requestHeaders.push({ 
        name: 'Authorization', 
        value: storedData.authorization
      });
    }
    return { requestHeaders };
  }

  onHeadersReceivedCallback(details) {
    if (!this.feProxyEnable || !this.feProxyCorsEnable) {
      return {};
    }
    const { type, tabId, initiator, originUrl, responseHeaders } = details;
    if (type === 'main_frame') {
      return {};
    }

    const storedData = feProxyStore.get(tabId);
    if (!storedData?.cors) {
      return {};
    }
    const prefs = FEC.CORS;
    let origin = '';
    if (prefs['unblock-initiator']) {
      try {
        const o = new URL(initiator || originUrl);
        origin = o.origin;
      } catch (e) {
        console.warn('cannot extract origin for initiator', initiator);
      }
    } else {
      origin = '*';
    }
  
    if (prefs['overwrite-origin'] === true) {
      const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-origin');
  
      if (o) {
        if (o.value !== '*') {
          o.value = origin || prefs['allow-origin-value'];
        }
      } else {
        responseHeaders.push({
          'name': 'Access-Control-Allow-Origin',
          'value': origin || prefs['allow-origin-value']
        });
      }
    }
    if (prefs.methods.length > 3) { // GET, POST, HEAD are mandatory
      const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-methods');
      if (o) {
        // only append methods that are not in the supported list
        o.value = [...new Set([...prefs.methods, ...o.value.split(/\s*,\s*/).filter(a => {
          return FEC.CORS.defautl_methods.indexOf(a) === -1;
        })])].join(', ');
      } else {
        responseHeaders.push({
          'name': 'Access-Control-Allow-Methods',
          'value': prefs.methods.join(', ')
        });
      }
    }
    // The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*'
    // when the request's credentials mode is 'include'.
    if (prefs['allow-credentials'] === true) {
      const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-origin');
      if (!o || o.value !== '*') {
        const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-credentials');
        if (o) {
          o.value = 'true';
        } else {
          responseHeaders.push({
            'name': 'Access-Control-Allow-Credentials',
            'value': 'true'
          });
        }
      }
    }
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
    if (prefs['allow-headers'] === true) {
      const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-allow-headers');
      if (o) {
        o.value = prefs['allow-headers-value'];
      } else {
        responseHeaders.push({
          'name': 'Access-Control-Allow-Headers',
          'value': prefs['allow-headers-value']
        });
      }
    }
    if (prefs['allow-headers'] === true) {
      const o = responseHeaders.find(({name}) => name.toLowerCase() === 'access-control-expose-headers');
      if (!o) {
        responseHeaders.push({
          'name': 'Access-Control-Expose-Headers',
          'value': prefs['expose-headers-value']
        });
      }
    }
    if (prefs['remove-x-frame'] === true) {
      const i = responseHeaders.findIndex(({name}) => name.toLowerCase() === 'x-frame-options');
      if (i !== -1) {
        responseHeaders.splice(i, 1);
      }
    }

    // 记录日志
    if (this.feProxyLoggerEnable) {
      console.log('%o.跨域 ---> responseHeaders: %o', tabId, responseHeaders);
    }

    return { responseHeaders };
  }
}

// 创建实例并初始化
const feProxy = new FeProxy();
feProxy.init(storage);

// 设置事件监听
runtime.onInstalled.addListener(() => {
  feProxy.init(storage);
  console.log('%cfe-proxy 插件初始化完成', `color: #60cc7d`);
});

storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  let needUpdateIcon = false;
  
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (['feProxyEnable', 'feProxyCorsEnable', 'feProxyLoggerEnable', 'feProxyGroups'].includes(key)) {
      if (oldValue !== newValue) {
        feProxy[key] = newValue;
        needUpdateIcon = true;
      }
    }
  }

  if (needUpdateIcon) {
    feProxy.updateIcon();
  }
});

// 关闭 tab 时，清理缓存数据
chrome.tabs.onRemoved.addListener(tabId => feProxyStore.delete[tabId]);

// 设置请求监听器
const setupRequestListeners = () => {
  const requestFilter = { urls: [FEC.CHROME.ALL_URLS] };

  // webRequest.onBeforeRequest.removeListener(feProxy.onBeforeRequestCallback);
  webRequest.onBeforeRequest.addListener(
    details => {
      return feProxy.onBeforeRequestCallback(details);
    },
    requestFilter,
    [FEC.CHROME.BLOCKING, FEC.CHROME.EXTRA_HEADERS]
  );

  // webRequest.onBeforeSendHeaders.removeListener(feProxy.onBeforeSendHeadersCallback);
  webRequest.onBeforeSendHeaders.addListener(
    details => {
      return feProxy.onBeforeSendHeadersCallback(details);
    },
    requestFilter,
    [FEC.CHROME.BLOCKING, FEC.CHROME.REQUEST_HEADERS, FEC.CHROME.EXTRA_HEADERS]
  );

  // webRequest.onHeadersReceived.removeListener(feProxy.onHeadersReceivedCallback);
  webRequest.onHeadersReceived.addListener(
    details => {
      return feProxy.onHeadersReceivedCallback(details);
    },
    requestFilter,
    [FEC.CHROME.BLOCKING, FEC.CHROME.RESPONSE_HEADERS, FEC.CHROME.EXTRA_HEADERS]
  );

  // webRequest.onBeforeRedirect.addListener(
  //   details => {
  //     console.log("onBeforeRedirect", details.tabId, details.method, details.url, details.redirectUrl);
  //   },
  //   requestFilter,
  //   [CONFIG.CHROME.RESPONSE_HEADERS, CONFIG.CHROME.EXTRA_HEADERS]
  // );
  
  // webRequest.onCompleted.addListener(
  //   details => {
  //     console.log("onCompleted", details.tabId, details.method, details.url);
  //   },
  //   requestFilter,
  //   [CONFIG.CHROME.RESPONSE_HEADERS, CONFIG.CHROME.EXTRA_HEADERS]
  // );
};

setupRequestListeners();
