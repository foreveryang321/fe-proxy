import { Modal, notification, Upload, UploadFile, UploadProps } from 'antd';
import React, { useState } from 'react';
import { FileOutlined, InboxOutlined } from '@ant-design/icons';
import { exportJSON } from './exportJson';
import { defaultGroups, GroupObject } from '../../common/value';

export const openImportJsonModal = () => new Promise((resolve: (val: GroupObject[] | unknown) => void) => {
  const Content = (props: { onFileChange: (f: UploadFile | null) => void }) => {
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [warnMsg, setWarnMsg] = useState('');
    const uploadProps: UploadProps = {
      showUploadList: false,
      beforeUpload: (file) => {
        if (file.type !== 'application/json') {
          setWarnMsg('只支持导入 json 格式文件。');
          setFileList([]);
          props.onFileChange(null);
          return false;
        } else {
          setWarnMsg('');
          setFileList([file]);
          props.onFileChange(file);
        }
        setFileList([file]);
        props.onFileChange(file);
        return false;
      },
      fileList,
    };
    return <>
      {
        (typeof FileReader === 'undefined') ? '当前浏览器不支持 FileReader' :
          <div style={{ minHeight: 210, marginTop: 12 }}>
            <Upload.Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined/>
              </p>
              <p className="ant-upload-text">单击或拖动文件到此区域</p>
              <p className="ant-upload-hint">
                <div>你可以导入一个 <strong>.json</strong> 文件来初始化
                  <a onClick={(e) => {
                    e.stopPropagation();
                    exportJSON('fe-proxy 插件数据模板', defaultGroups);
                  }}>&nbsp;fe-proxy 插件&nbsp;</a>
                  规则。
                </div>
              </p>
            </Upload.Dragger>
            <div style={{ background: '#f5f5f5', lineHeight: '22px', padding: '0 12px', marginTop: 8 }}>
              {fileList[0] && <FileOutlined style={{ marginRight: 8 }}/>}
              {fileList[0]?.name}
            </div>
            <div style={{ color: '#ff4d4f' }}>{warnMsg}</div>
          </div>
      }
    </>;
  };
  let _file: Blob | UploadFile<any> | null = null;
  Modal.confirm({
    icon: null,
    width: '92%',
    title: '导入规则',
    content: <Content onFileChange={(file: UploadFile | null) => _file = file}/>,
    okText: '导入',
    cancelText: '取消',
    onOk: () => {
      if (_file) {
        importJSON(_file).then((result) => {
          resolve(result);
        }).catch((error) => {
          notification.error({
            message: error.message,
          });
        });
      }
    },
  });
});

const importJSON = (file: Blob | UploadFile<any>) => new Promise((resolve, reject) => {

  const reader = new FileReader();
  reader.readAsText(file as Blob);

  reader.onerror = (error) => {
    reject({
      message: '解析 json 文件错误',
      description: error
    });
  };

  reader.onload = () => {
    const resultData = reader.result;
    if (resultData) {
      try {
        if (typeof resultData === 'string') {
          const importData = JSON.parse(resultData);
          resolve(importData);
        }
      } catch (error) {
        reject({
          message: '解析 json 文件错误',
          description: error
        });
      }
    } else {
      reject({
        message: '提示',
        description: '读取 json 文件错误'
      });
    }
  };
});
