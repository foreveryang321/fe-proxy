import React, { useEffect, useRef, useState } from 'react';
import { Button, Collapse, Dropdown, Input, MenuProps, Result, Space, Switch } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  DropboxOutlined,
  ExpandOutlined,
  FormOutlined,
  MoreOutlined,
  PlusOutlined,
  ToTopOutlined,
  UploadOutlined
} from '@ant-design/icons';
import ModifyDataModal, { ModifyDataModalOnSaveProps } from './ModifyDataModal';
import { defaultGroups, defaultRule, RuleObject } from '../common/value';
import './App.css';
import { exportJSON } from './utils/exportJson';
import { openImportJsonModal } from './utils/importJson';
import { popupWindow } from './utils/pictureInPicture';

function App() {
  const modifyDataModalRef = useRef<any>({});

  const [feProxyEnable, setFeProxyEnable] = useState(true); // 默认开启
  const [feProxyCorsEnable, setFeProxyCorsEnable] = useState(true); // 默认开启
  const [feProxyLoggerEnable, setFeProxyLoggerEnable] = useState(true); // 默认开启
  const [feProxyGroups, setFeProxyGroups] = useState(defaultGroups);
  const [feProxyCollapseActiveKey, setFeProxyCollapseActiveKey] = useState(['']);

  useEffect(() => {
    if (chrome.storage) {
      chrome.storage.local.get([
        'feProxyGroups', 'feProxyEnable', 'feProxyCorsEnable',
        'feProxyLoggerEnable', 'feProxyCollapseActiveKey'
      ], (result) => {
        const {
          feProxyGroups = [], feProxyEnable = false, feProxyCorsEnable = false,
          feProxyLoggerEnable = false, feProxyCollapseActiveKey = ''
        } = result;
        if (feProxyGroups.length > 0) {
          setFeProxyGroups(feProxyGroups);
        }
        setFeProxyEnable(feProxyEnable);
        setFeProxyCorsEnable(feProxyCorsEnable);
        setFeProxyLoggerEnable(feProxyLoggerEnable);
        setFeProxyCollapseActiveKey(feProxyCollapseActiveKey);
      });
    }
  }, []);

  const onImportClick = async () => {
    const importJsonData = await openImportJsonModal();
    if (Array.isArray(importJsonData)) {
      let importFeProxyGroups = feProxyGroups;
      importFeProxyGroups = [...feProxyGroups, ...importJsonData];
      setFeProxyGroups(importFeProxyGroups);
      chrome.storage.local.set({ feProxyGroups: importFeProxyGroups });
    }
  };
  const onCollapseChange = (keys: string | string[]) => {
    const feProxyCollapseActiveKey = Array.isArray(keys) ? keys : [keys];
    setFeProxyCollapseActiveKey([...feProxyCollapseActiveKey]);
    chrome.storage.local.set({ feProxyCollapseActiveKey: feProxyCollapseActiveKey });
  };
  const onFeProxyGroupAdd = () => {
    const newFeProxyGroups = [...feProxyGroups, {
      name: '请输入分组名称（可编辑）',
      enable: true,
      authorization: '',
      rules: [{ ...defaultRule }]
    }];
    setFeProxyGroups([...newFeProxyGroups]);
    chrome.storage.local.set({ feProxyGroups: newFeProxyGroups });
  };
  const onFeProxyGroupDelete = (groupIndex: number) => {
    const newFeProxyGroups = feProxyGroups.filter((_, i) => i !== groupIndex);
    setFeProxyGroups([...newFeProxyGroups]);
    chrome.storage.local.set({ feProxyGroups: newFeProxyGroups });
  };
  const onFeProxyGroupMove = (groupIndex: number, placement: string) => {
    const movedItem = feProxyGroups.splice(groupIndex, 1)[0];
    if (placement === 'top') {
      feProxyGroups.unshift(movedItem);
    } else if (placement === 'bottom') {
      feProxyGroups.push(movedItem);
    }
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>, groupIndex: number) => {
    feProxyGroups[groupIndex].name = e.target.value;
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyGroupEnableChange = (groupIndex: number, enable: boolean) => {
    feProxyGroups[groupIndex].enable = enable;
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyGroupAuthorizationChange = (e: React.ChangeEvent<HTMLInputElement>, groupIndex: number) => {
    feProxyGroups[groupIndex].authorization = e.target.value;
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyRuleChange = (groupIndex: number, ruleIndex: number, key: string, value: string | boolean) => {
    if (key === 'headers' || key === 'responseText') {
      try {
        const lastValue = feProxyGroups[groupIndex]?.rules?.[ruleIndex]?.[key];
        const formattedValue = JSON.stringify(JSON.parse(value as string), null, 4);
        value = lastValue === formattedValue ? value : formattedValue;
      } catch (e) {
        // value = value;
      }
    }
    feProxyGroups[groupIndex].rules[ruleIndex][key]! = value;
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyRuleAdd = (groupIndex: number) => {
    const rule = { ...defaultRule };
    rule.key = String(Date.now());
    feProxyGroups[groupIndex].rules.push(rule);
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyRuleDelete = (groupIndex: number, key: string) => {
    feProxyGroups[groupIndex].rules = feProxyGroups[groupIndex].rules.filter((v) => v.key !== key);
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };
  const onFeProxyRuleSave = (
    { groupIndex, ruleIndex, url, forwardUrl }: ModifyDataModalOnSaveProps
  ) => {
    if (url !== undefined) onFeProxyRuleChange(groupIndex, ruleIndex, 'url', url);
    if (forwardUrl !== undefined) onFeProxyRuleChange(groupIndex, ruleIndex, 'forwardUrl', forwardUrl);
  };
  const onFeProxyRuleMove = (groupIndex: number, ruleIndex: number, placement: string) => {
    const { rules = [] } = feProxyGroups[groupIndex];
    const movedItem = rules.splice(ruleIndex, 1)[0];
    if (placement === 'top') {
      rules.unshift(movedItem);
    } else if (placement === 'bottom') {
      rules.push(movedItem);
    }
    feProxyGroups[groupIndex].rules = rules;
    setFeProxyGroups([...feProxyGroups]);
    chrome.storage.local.set({ feProxyGroups });
  };

  const getGroupExtra = (
    index: number,
    enable: boolean
  ) => {
    const items: MenuProps['items'] = [
      {
        key: '0',
        label: 'Move to top',
        icon: <ToTopOutlined style={{ fontSize: 14 }}/>,
        onClick: () => onFeProxyGroupMove(index, 'top'),
        disabled: index === 0
      },
      {
        key: '1',
        label: 'Move to bottom',
        icon: <ToTopOutlined style={{ transform: 'rotateZ(180deg)', fontSize: 14 }}/>,
        onClick: () => onFeProxyGroupMove(index, 'bottom'),
        disabled: index === feProxyGroups.length - 1
      },
      {
        key: '99',
        danger: true,
        label: '删除组',
        icon: <DeleteOutlined style={{ fontSize: 14 }}/>,
        onClick: () => onFeProxyGroupDelete(index)
      }
    ];
    return <div onClick={(event) => event.stopPropagation()}>
      <Switch
        title={enable ? '禁用组' : '启用组'}
        checked={enable}
        size="small"
        onChange={(enable) => onFeProxyGroupEnableChange(index, enable)}
      />
      <Dropdown
        menu={{ items }}
        trigger={['click']}>
        <MoreOutlined title="More" style={{ marginLeft: 8 }}/>
      </Dropdown>
    </div>;
  };

  const getRuleExtra = (
    groupIndex: number,
    ruleIndex: number,
    v: RuleObject,
  ) => {
    const { rules = [] } = feProxyGroups[groupIndex];
    const items: MenuProps['items'] = [
      {
        key: '0',
        label: '编辑规则',
        icon: <FormOutlined style={{ fontSize: 14 }}/>,
        onClick: () => modifyDataModalRef.current.openModal({
          groupIndex,
          ruleIndex,
          url: v.url,
          forwardUrl: v.forwardUrl
        })
      },
      {
        key: '1',
        label: 'Move to top',
        icon: <ToTopOutlined style={{ fontSize: 14 }}/>,
        onClick: () => onFeProxyRuleMove(groupIndex, ruleIndex, 'top'),
        disabled: ruleIndex === 0
      },
      {
        key: '2',
        label: 'Move to bottom',
        icon: <ToTopOutlined style={{ transform: 'rotateZ(180deg)', fontSize: 14 }}/>,
        onClick: () => onFeProxyRuleMove(groupIndex, ruleIndex, 'bottom'),
        disabled: ruleIndex === rules.length - 1
      },
      {
        key: '3',
        danger: true,
        label: '删除规则',
        icon: <DeleteOutlined style={{ fontSize: 14 }}/>,
        onClick: () => onFeProxyRuleDelete(groupIndex, v.key)
      }
    ];
    return <div onClick={(event) => event.stopPropagation()}>
      <Switch
        title={v.enable ? '禁用规则' : '启用规则'}
        checked={v.enable}
        onChange={(value) => onFeProxyRuleChange(groupIndex, ruleIndex, 'enable', value)}
        size="small"
        style={{ marginLeft: '4px' }}
      />
      <Dropdown
        menu={{ items }}
        trigger={['click']}
      >
        <MoreOutlined title="More" style={{ marginLeft: 8, color: '#000' }}/>
      </Dropdown>
    </div>;
  };

  const inIframe = top?.location !== self.location;
  return (
    <div
      className="fe-proxy-container"
    >
      <nav className="fe-proxy-nav">
        <Space>
          <Dropdown.Button
            size="small"
            type="primary"
            onClick={onFeProxyGroupAdd}
            menu={{
              items: [
                {
                  key: '1',
                  label: '导入',
                  icon: <UploadOutlined style={{ fontSize: 14 }}/>,
                  onClick: onImportClick
                },
                {
                  key: '2',
                  label: '导出',
                  icon: <DownloadOutlined style={{ fontSize: 14 }}/>,
                  onClick: () => exportJSON(`Ng_Data_${JSON.stringify(new Date())}`, feProxyGroups),
                  disabled: feProxyGroups.length < 1
                },
              ]
            }}>
            新增组
          </Dropdown.Button>
        </Space>
        <div>
          <Space>
            <Switch
              defaultChecked
              checkedChildren="转发"
              unCheckedChildren="转发"
              checked={feProxyEnable}
              onChange={(value) => {
                setFeProxyEnable(value);
                chrome.storage.local.set({ feProxyEnable: value });
              }}
            />
            <Switch
              defaultChecked
              checkedChildren="跨域"
              unCheckedChildren="跨域"
              checked={feProxyCorsEnable}
              onChange={(value) => {
                setFeProxyCorsEnable(value);
                chrome.storage.local.set({ feProxyCorsEnable: value });
              }}
            />
            <Switch
              defaultChecked
              checkedChildren="日志"
              unCheckedChildren="日志"
              checked={feProxyLoggerEnable}
              onChange={(value) => {
                setFeProxyLoggerEnable(value);
                chrome.storage.local.set({ feProxyLoggerEnable: value });
              }}
            />
          </Space>
          {
            inIframe ? null : <i
              title="画中画"
              style={{ marginLeft: 12, cursor: 'pointer' }}
              onClick={() => popupWindow({ url: chrome.runtime.getURL('index.html') })}
            ><ExpandOutlined/></i>
          }
        </div>
      </nav>
      <main
        className="fe-proxy-body"
        style={{ filter: feProxyEnable ? undefined : 'opacity(0.5)' }}
      >
        {
          feProxyGroups.map((group, index) => {
            const groupOpacityFilter = feProxyEnable ? group.enable : !feProxyEnable;
            const { rules = [] } = group;
            return <Collapse
              className="fe-proxy-collapse fe-proxy-color-green"
              key={'collapse-' + index}
              accordion
              activeKey={feProxyCollapseActiveKey}
              defaultActiveKey={feProxyCollapseActiveKey}
              onChange={(keys) => onCollapseChange(keys)}
              expandIconPosition="end"
              size="small"
              style={{ filter: groupOpacityFilter ? undefined : 'opacity(0.5)' }}
              items={
                [{
                  key: 'panel-' + index,
                  label: <div onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'inline-grid', width: '100%' }}>
                      <Input
                        value={group.name}
                        className="fe-proxy-body-header-input fe-proxy-color-green"
                        onChange={(e) => onFeProxyGroupNameChange(e, index)}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>,
                  extra: getGroupExtra(index, group.enable),
                  children: <div style={{ position: 'relative' }}>
                    <div onClick={e => e.stopPropagation()}
                         style={{ padding: '8px 0', width: '100%' }}>
                      <Input
                        value={group.authorization}
                        onChange={(e) => onFeProxyGroupAuthorizationChange(e, index)}
                        placeholder="请输入 Authorization 请求头接口调用凭证"
                        size="small"
                        addonBefore="接口凭证"
                        style={{ width: '100%' }}
                      />
                    </div>
                    {
                      rules.map((rule, i) => {
                        const ruleOpacityFilter = feProxyEnable ? (group.enable ? rule.enable : !group.enable) : !feProxyEnable;
                        return <Collapse
                          key={'children-' + index + '-' + i}
                          accordion
                          expandIconPosition="end"
                          size="small"
                          style={{ filter: ruleOpacityFilter ? undefined : 'opacity(0.5)', marginBottom: '3px' }}
                          items={
                            [{
                              key: 'collapse-' + index + '-' + i,
                              showArrow: false,
                              collapsible: 'disabled',
                              label: <div onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'inline-grid', width: '100%' }}>
                                  <Space direction="vertical">
                                    <Input
                                      value={rule.url}
                                      onChange={(e) => onFeProxyRuleChange(index, i, 'url', e.target.value)}
                                      placeholder="请输入原始地址"
                                      size="small"
                                      addonBefore="原始地址"
                                    />
                                    <Input
                                      value={rule.forwardUrl}
                                      onChange={(e) => onFeProxyRuleChange(index, i, 'forwardUrl', e.target.value)}
                                      placeholder="请输入转发地址"
                                      size="small"
                                      addonBefore="转发地址"
                                    />
                                  </Space>
                                </div>
                              </div>,
                              extra: getRuleExtra(index, i, rule)
                            }]
                          }
                        />;
                      })
                    }
                    <div className="fe-proxy-group-footer">
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined/>}
                        onClick={() => onFeProxyRuleAdd(index)}
                      >新增规则</Button>
                    </div>
                  </div>
                }]
              }
            />;
          })
        }
        {
          feProxyGroups.length < 1 && <Result
            icon={<DropboxOutlined style={{ color: '#c1d0dd' }}/>}
            title={'没有数据'}
            subTitle={<>
              点击 <Button size="small" type="primary"
                           onClick={onFeProxyGroupAdd}>新增组</Button> 按钮来创建一条规则，<br/>
              或者通过 <Button size="small" style={{ marginTop: 6 }}
                               onClick={onImportClick}><UploadOutlined/>导入</Button> 按钮导入 <strong>.json</strong> 文件来创建。
            </>}
          />
        }
      </main>
      <footer className="fe-proxy-footer">
        fe-proxy v1.17.2
      </footer>
      <ModifyDataModal
        ref={modifyDataModalRef}
        onSave={onFeProxyRuleSave}
      />
    </div>
  );
}

export default App;
