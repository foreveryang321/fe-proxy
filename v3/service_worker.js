// eslint-disable-next-line no-undef
const { storage, action, sidePanel, runtime } = chrome;

action.onClicked.addListener(async () => {
  sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

const CONFIG = {
  COLORS: {
    ON: '#1890ff',
    OFF: '#bfbfbf'
  },
  BADGE: {
    OFF: 'OFF'
  },
  DNR: {
    RESOURCE_TYPES: [
      'main_frame',
      'sub_frame',
      'stylesheet',
      'script',
      'image',
      'font',
      'object',
      'xmlhttprequest',
      'ping',
      'csp_report',
      'media',
      'websocket',
      'other'
    ]
  }
};

class FeProxy {
  constructor() {
    this.feProxyEnable = false;
    this.feProxyCorsEnable = false;
    this.feProxyLoggerEnable = false;
    this.feProxyGroups = [];
  }

  init(storage) {
    storage.local.get(null, (result) => {
      // 使用默认值合并配置
      this.feProxyEnable = result?.feProxyEnable ?? false;
      this.feProxyCorsEnable = result?.feProxyCorsEnable ?? false;
      this.feProxyLoggerEnable = result?.feProxyLoggerEnable ?? false;
      this.feProxyGroups = result?.feProxyGroups ?? [];

      this.updateIcon();
      this.updateDynamicRules();
    });
  }

  updateIcon() {
    const badgeText = this.feProxyEnable ? 
      this._getEnableRuleSize().toString() : 
      CONFIG.BADGE.OFF;
    
    const color = this.feProxyEnable ? 
      CONFIG.COLORS.ON : 
      CONFIG.COLORS.OFF;

    action.setBadgeText({ text: badgeText });
    action.setBadgeBackgroundColor({ color });
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

  async updateDynamicRules() {
    // 获取当前所有规则
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = currentRules.map(rule => rule.id);

    if (!this.feProxyEnable) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds
      });
      return;
    }

    const rules = [];
    // 找到当前最大的规则 ID，新规则 ID 从最大值+1 开始
    const maxRuleId = Math.max(0, ...removeRuleIds);
    let nextRuleId = maxRuleId + 1;

    for (const group of this.feProxyGroups) {
      if (!group?.enable || !group.rules) continue;

      for (const rule of group.rules) {
        if (!rule.enable || !rule.url || !rule.forwardUrl) continue;
        if (group.authorization) {
          rules.push({
            id: nextRuleId++,
            priority: 3,
            condition: {
              // regexFilter: rule.url,
              // urlFilter: "|http*",
              urlFilter: "|" + rule.forwardUrl + "*",
              // 不是所有资源类型都需要添加 Authorization 头
              resourceTypes: ['xmlhttprequest']
            },
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {
                  header: "Authorization",
                  operation: "set",
                  value: group.authorization
                }
              ]
            }
          });
        }

        // 添加重定向规则
        rules.push({
          id: nextRuleId++,
          priority: 2,
          condition: {
            regexFilter: rule.url,
            resourceTypes: CONFIG.DNR.RESOURCE_TYPES
          },
          action: {
            type: 'redirect',
            redirect: {
              regexSubstitution: rule.forwardUrl
            }
          }
        });

        if (this.feProxyCorsEnable) {
          rules.push({
            id: nextRuleId++,
            priority: 1,
            condition: {
              // regexFilter: rule.forwardUrl,
              urlFilter: "|http*",
              resourceTypes: CONFIG.DNR.RESOURCE_TYPES
            },
            action: {
              type: 'modifyHeaders',
              responseHeaders: [
                {
                  header: 'Access-Control-Allow-Origin',
                  operation: 'set',
                  value: '{request_header:referer}'
                },
                // {
                //   header: "Content-Security-Policy",
                //   operation: "set",
                //   value: ""
                // },
                {
                  header: 'Access-Control-Allow-Methods',
                  operation: 'set',
                  value: 'GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH'
                },
                {
                  header: 'Access-Control-Allow-Headers',
                  operation: 'set',
                  value: 'Content-Type, Authorization, X-Requested-With, X-Referer'
                },
                {
                  header: 'Access-Control-Allow-Credentials',
                  operation: 'set',
                  value: 'true'
                },
                {
                  header: 'Access-Control-Max-Age',
                  operation: 'set',
                  value: '86400'
                }
              ]
            }
          });
        }
      }
    }

    // 更新动态规则：先移除所有现有规则，再添加新规则
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules
    });
  }
}

const feProxy = new FeProxy();

// 初始化
feProxy.init(storage);

// 设置事件监听
runtime.onInstalled.addListener(() => {
  feProxy.init(storage);
  console.log('%cfe-proxy 插件初始化完成', `color: #60cc7d`);
});

// 监听存储变化
storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  let needUpdate = false;
  
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (['feProxyEnable', 'feProxyCorsEnable', 'feProxyLoggerEnable', 'feProxyGroups'].includes(key)) {
      if (oldValue !== newValue) {
        feProxy[key] = newValue;
        needUpdate = true;
      }
    }
  }

  if (needUpdate) {
    feProxy.updateIcon();
    feProxy.updateDynamicRules();
  }
});
