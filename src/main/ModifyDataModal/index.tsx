import {  Modal, Input, Space } from 'antd';
import React, { ForwardedRef, useImperativeHandle, useState } from 'react';

import './index.css';

export interface ModifyDataModalOnSaveProps {
  groupIndex: number,
  ruleIndex: number,
  url: string,
  forwardUrl: string
}
interface ModifyDataModalProps {
  onSave: (
    { groupIndex, ruleIndex, url, forwardUrl } : ModifyDataModalOnSaveProps
  ) => void;
}
interface OpenModalProps {
  groupIndex: number,
  ruleIndex: number,
  url: string;
  forwardUrl: string;
}

const ModifyDataModal = (
  props: ModifyDataModalProps,
  ref: ForwardedRef<{ openModal: (props: OpenModalProps)=>void }>
) => {
  const { onSave = () => {} } = props;
  const [open, setOpen] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [ruleIndex, setRuleIndex] = useState(0);
  const [url, setUrl] = useState('');
  const [forwardUrl, setForwardUrl] = useState('');

  useImperativeHandle(ref, () => ({
    openModal
  }));

  const openModal = (
    { groupIndex, ruleIndex, url, forwardUrl } : OpenModalProps
  ) => {
    setGroupIndex(groupIndex);
    setRuleIndex(ruleIndex);
    setUrl(url);
    setForwardUrl(forwardUrl);
    setOpen(true);
  };

  const handleOk = () => {
    onSave(
      { groupIndex, ruleIndex, url, forwardUrl }
    );
    setOpen(false);
  };

  return <>
    <Modal
      centered
      title={<span style={{ fontSize: 12 }}>路径：{url}</span>}
      width={'98%'}
      open={open}
      onOk={handleOk}
      onCancel={() => setOpen(false)}
      okText="保存"
      cancelText="取消"
      bodyStyle={{
        padding: 12
      }}
    >
      <Space direction="vertical" size="small" style={{ display: 'flex' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            addonBefore="原始地址"
            value={url}
            placeholder="请输入原始地址"
            onChange={(e) => setUrl(e.target.value)}
          />
        </Space.Compact>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            addonBefore="转发地址"
            value={forwardUrl}
            placeholder="请输入转发地址"
            onChange={(e) => setForwardUrl(e.target.value)}
          />
        </Space.Compact>
      </Space>
    </Modal>
  </>;
};
export default React.memo(React.forwardRef(ModifyDataModal));
