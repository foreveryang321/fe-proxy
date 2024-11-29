export interface RuleObject {
  key: string,
  enable: boolean,
  url: string,
  forwardUrl: string,
  [key: string]: any
}

export const defaultRule: RuleObject = {
  key: String(Date.now()),
  enable: true,
  url: '',
  forwardUrl: '',
};

export interface GroupObject {
  name: string,
  enable: boolean,
  authorization: string,
  rules: RuleObject[]
}

export const defaultGroups: GroupObject[] = [
  {
    name: '请输入分组名称（可编辑）',
    enable: true,
    authorization: '',
    rules: [
      { ...defaultRule },
    ]
  }
];
