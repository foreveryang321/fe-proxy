// eslint-disable-next-line no-undef
const { storage, browserAction, runtime, webRequest } = chrome;

const CONFIG = {
  COLORS: {
    ON: '#1890ff',
    OFF: '#bfbfbf'
  },
  BADGE: {
    OFF: 'OFF'
  },
  CORS: {
    ALLOW_METHODS: 'Access-Control-Allow-Methods',
    ALLOW_CREDENTIALS: 'Access-Control-Allow-Credentials',
    ALLOW_ORIGIN: 'Access-Control-Allow-Origin',
    ALLOW_HEADERS: 'Access-Control-Allow-Headers',
    DEFAULT_ORIGIN: '*',
    DEFAULT_METHODS: 'GET, POST, PUT, DELETE, OPTIONS',
    DEFAULT_CREDENTIALS: 'true',
    DEFAULT_HEADERS: 'Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-Requested-With, X-Referer'
  },
  HEADERS: {
    ORIGIN: 'Origin',
    // REFERER: 'Referer',
    ACCESS_CONTROL_REQUEST: 'Access-Control-Request-Headers'
  },
  REG: {
    CHROME_EXTENSION: /^chrome-extension:\/\//i,
    FORWARD: /\\|\[|]|\(|\)|\*|\$|\^/i,
    X_HEADER: /^[x|X]-/
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
  }
};

class FeProxy {
  constructor() {
    this.feProxyEnable = false;
    this.feProxyCorsEnable = false;
    this.feProxyLoggerEnable = false;
    this.feProxyGroups = [];
    
    // 合并所有请求相关的 Map
    this.requestStore = new Map();
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
      CONFIG.BADGE.OFF;
    
    const color = this.feProxyEnable ? 
      CONFIG.COLORS.ON : 
      CONFIG.COLORS.OFF;

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

  _getMatchRule(originUrl) {
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
          this.requestStore.set(originUrl, {
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
      if (CONFIG.REG.FORWARD.test(ruleUrl)) {
        const regex = new RegExp(ruleUrl.replace('??', '\\?\\?'), 'i');
        return regex.test(originUrl) ? CONFIG.UrlType.REG : false;
      }
      return originUrl.includes(ruleUrl) ? CONFIG.UrlType.STRING : false;
    } catch (error) {
      console.error('Error in matchUrl:', error);
      return false;
    }
  }

  _buildProxyUrl(originUrl, ruleUrl, ruleForwardUrl, matchType) {
    if (matchType === CONFIG.UrlType.REG) {
      const r = new RegExp(ruleUrl.replace('??', '\\?\\?'), 'i');
      return originUrl.replace(r, ruleForwardUrl).trim();
    }
    return originUrl.split(ruleUrl).join(ruleForwardUrl).trim();
  }

  onBeforeRequestCallback(details) {
    let originUrl = details.url;
    
    // 检查是否为 chrome 扩展请求
    if (CONFIG.REG.CHROME_EXTENSION.test(originUrl)) {
      return {};
    }

    try {
      const rule = this._getMatchRule(originUrl);
      if (!rule) {
        return {};
      }

      const proxyUrl = rule.proxyUrl;
      if (proxyUrl === originUrl) {
        return {};
      }
      
      // 记录日志
      if (this.feProxyLoggerEnable) {
        console.log('%o.转发 ---> 原始请求: %o, 转发请求: %o', details.requestId, originUrl, proxyUrl);
      }

      return { redirectUrl: proxyUrl };
    } catch (error) {
      console.error('Error in onBeforeRequestCallback:', error);
      return {};
    }
  }

  onBeforeRedirectCallback(details) {
    const { url, redirectUrl } = details;
    const storeData = this.requestStore.get(url);
    if (storeData) {
      // 清理请求数据
      this.requestStore.delete(url);
      // 重新放回去，不过这里使用 redirectUrl
      this.requestStore.set(redirectUrl, storeData);
    }
  }

  onBeforeSendHeadersCallback(details) {
    const { url, requestHeaders, requestId } = details;
    
    if (CONFIG.REG.CHROME_EXTENSION.test(url)) {
      return { requestHeaders };
    }

    const requestData = { headers: [] };
    
    // 处理请求头
    for (const header of requestHeaders) {
      const headerName = header.name;
      if (headerName === CONFIG.HEADERS.ORIGIN /*|| headerName === CONFIG.HEADERS.REFERER*/) {
        requestData.originHeader = header.value;
      } else if (headerName === CONFIG.HEADERS.ACCESS_CONTROL_REQUEST || CONFIG.REG.X_HEADER.test(headerName)) {
        requestData.headers.push(headerName);
      }
    }
    // 这里使用 url 获取缓存中的数据，因为在 onBeforeRedirectCallback 中使用的是 redirectUrl 作为缓存 key
    const storedData = this.requestStore.get(url) || {};
    if (requestData.headers.length || requestData.originHeader) {
      this.requestStore.set(url, { ...storedData, ...requestData });
    }

    // 处理授权信息
    if (this.feProxyEnable && storedData?.authorization) {
      // 记录日志
      if (this.feProxyLoggerEnable) {
        console.log('%o.请求头 ---> Authorization: %o', requestId, storedData.authorization);
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

    const { url, requestId } = details;

    const storedData = this.requestStore.get(url);
    if (!storedData?.cors) {
      return {};
    }

    const responseHeaders = this._buildCorsHeaders(details, storedData);
    // 记录日志
    if (this.feProxyLoggerEnable) {
      console.log('%o.跨域 ---> responseHeaders: %o', requestId, responseHeaders);
    }

    // 清理请求数据
    this.requestStore.delete(url);

    return { responseHeaders };
  }

  _buildCorsHeaders(details, requestData) {
    let responseHeaders = [];
    let corsOrigin = (requestData.originHeader || details.initiator) || CONFIG.CORS.DEFAULT_ORIGIN;

    // 处理现有响应头
    if (details.responseHeaders?.length) {
      let hasCredentials = false;
      let tempOrigin = '';

      responseHeaders = details.responseHeaders.filter(header => {
        const headerName = header.name;
        if (CONFIG.CORS.ALLOW_ORIGIN === headerName) {
          tempOrigin = header.value;
        }

        if (CONFIG.CORS.ALLOW_CREDENTIALS === headerName) {
          hasCredentials = header.value;
        }

        return ![
          CONFIG.CORS.ALLOW_ORIGIN,
          CONFIG.CORS.ALLOW_CREDENTIALS,
          CONFIG.CORS.ALLOW_METHODS,
          CONFIG.CORS.ALLOW_HEADERS
        ].includes(headerName);
      });

      // 如果有 credentials，使用原始的 origin
      if (hasCredentials) {
        corsOrigin = tempOrigin;
      }
    }

    // 特殊情况处理
    if (corsOrigin === CONFIG.CORS.DEFAULT_ORIGIN && requestData.originHeader === 'null') {
      corsOrigin = CONFIG.CORS.DEFAULT_ORIGIN;
    }

    // 添加 CORS 头
    responseHeaders.push({
      name: CONFIG.CORS.ALLOW_ORIGIN,
      value: corsOrigin
    });

    responseHeaders.push({
      name: CONFIG.CORS.ALLOW_CREDENTIALS,
      value: CONFIG.CORS.DEFAULT_CREDENTIALS
    });

    responseHeaders.push({
      name: CONFIG.CORS.ALLOW_METHODS,
      value: CONFIG.CORS.DEFAULT_METHODS
    });

    // 处理自定义请求头
    let corsHeaders = '';
    if (requestData.headers?.length) {
      corsHeaders = ', ' + requestData.headers.join(', ');
    }

    responseHeaders.push({
      name: CONFIG.CORS.ALLOW_HEADERS,
      value: CONFIG.CORS.DEFAULT_HEADERS + corsHeaders
    });

    return responseHeaders;
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

// 设置请求监听器
const setupRequestListeners = () => {
  const requestFilter = { urls: [CONFIG.CHROME.ALL_URLS] };

  webRequest.onBeforeRequest.addListener(
    details => {
      return feProxy.onBeforeRequestCallback(details);
    },
    requestFilter,
    [CONFIG.CHROME.BLOCKING, CONFIG.CHROME.EXTRA_HEADERS]
  );

  webRequest.onBeforeSendHeaders.addListener(
    details => {
      return feProxy.onBeforeSendHeadersCallback(details);
    },
    requestFilter,
    [CONFIG.CHROME.BLOCKING, CONFIG.CHROME.REQUEST_HEADERS, CONFIG.CHROME.EXTRA_HEADERS]
  );

  webRequest.onHeadersReceived.addListener(
    details => {
      return feProxy.onHeadersReceivedCallback(details);
    },
    requestFilter,
    [CONFIG.CHROME.BLOCKING, CONFIG.CHROME.RESPONSE_HEADERS, CONFIG.CHROME.EXTRA_HEADERS]
  );

  webRequest.onBeforeRedirect.addListener(
    details => {
        feProxy.onBeforeRedirectCallback(details);
    },
    requestFilter
  );
};

setupRequestListeners();
