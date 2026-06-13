export type WorkflowStep = {
  id: string;
  title: string;
  status: "current" | "done" | "todo";
};

export type TaskField = {
  label: string;
  value: string;
};

export type SlideDraft = {
  page: number;
  title: string;
  body: string;
  visual: string;
};

export const workflowSteps: WorkflowStep[] = [
  { id: "step-1", title: "需求理解", status: "current" },
  { id: "step-2", title: "内容大纲", status: "done" },
  { id: "step-3", title: "页面文案", status: "done" },
  { id: "step-4", title: "视觉生成", status: "todo" },
  { id: "step-5", title: "PPT 编辑", status: "todo" },
  { id: "step-6", title: "动效与配音", status: "todo" },
  { id: "step-7", title: "视频合成", status: "todo" },
];

export const taskFields: TaskField[] = [
  { label: "主题", value: "火山喷发过程" },
  { label: "内容类型", value: "自然科学 / 地理科普" },
  { label: "输出形式", value: "PPT" },
  { label: "页数", value: "10页" },
  { label: "受众", value: "中学生" },
  { label: "当前任务", value: "生成内容大纲与页面文案" },
  {
    label: "后续可选",
    value: "生成PPT / 生成长图 / 添加动效配音 / 合成视频",
  },
];

export const generationSteps = [
  "第1页：火山为什么会喷发？",
  "第2页：地球内部像一台巨大的热机器",
  "第3页：岩浆是怎么形成的？",
  "第4页：火山的基本结构",
  "第5页：喷发前，地下正在发生什么？",
  "第6页：火山喷发的关键过程",
  "第7页：火山喷发不只有一种方式",
  "第8页：火山喷发会带来哪些影响？",
  "第9页：火山也不全是破坏者",
  "第10页：我们如何监测火山？",
];

export const outlineItems = [
  "火山为什么会喷发？",
  "地球内部像一台巨大的热机器",
  "岩浆是怎么形成的？",
  "火山的基本结构",
  "喷发前，地下正在发生什么？",
  "火山喷发的关键过程",
  "火山喷发不只有一种方式",
  "火山喷发会带来哪些影响？",
  "火山也不全是破坏者",
  "我们如何监测火山？",
];

export const slideDrafts: SlideDraft[] = [
  {
    page: 1,
    title: "火山为什么会喷发？",
    body: "火山喷发看起来像地球突然“爆炸”，但它并不是毫无征兆的灾难。火山喷发的背后，是地球内部高温、岩浆、气体和压力共同作用的结果。",
    visual: "一座正在喷发的火山，地下有岩浆通道的剖面图。",
  },
  {
    page: 2,
    title: "地球内部像一台巨大的热机器",
    body: "地球表面看起来很稳定，但地球内部一直非常炽热。越往地下深处，温度越高。火山喷发的能量来源，正是地球内部长期积累的热量。",
    visual: "地球剖面图，标出地壳、地幔、外核、内核。",
  },
  {
    page: 3,
    title: "岩浆是怎么形成的？",
    body: "岩浆是由熔融岩石、矿物和气体组成的高温物质。当地下岩石受到高温、压力变化或水分影响时，部分岩石会熔化，形成岩浆。",
    visual: "岩石熔融变成岩浆的过程图。",
  },
  {
    page: 4,
    title: "火山的基本结构",
    body: "一座火山通常包括岩浆房、火山通道、火山口和火山锥。岩浆房像地下的“储藏室”，岩浆会先在那里聚集。",
    visual: "火山剖面结构图，突出岩浆房、通道、火山口。",
  },
  {
    page: 5,
    title: "喷发前，地下正在发生什么？",
    body: "火山喷发前，岩浆会不断向上挤压，可能导致地面轻微隆起、小地震增多、火山气体释放增加。",
    visual: "火山下方岩浆上升，地表出现小裂缝和轻微隆起。",
  },
  {
    page: 6,
    title: "火山喷发的关键过程",
    body: "当岩浆中的气体和压力超过上方岩石能够承受的范围时，岩浆会冲破阻挡，沿着火山通道快速上升，最终从火山口喷出。",
    visual: "用箭头展示岩浆从岩浆房上升到火山口的过程。",
  },
  {
    page: 7,
    title: "火山喷发不只有一种方式",
    body: "有些火山喷发比较平缓，熔岩像河流一样慢慢流出；有些火山喷发非常猛烈，会把火山灰和岩石碎片喷到高空。",
    visual: "对比平缓熔岩流和爆炸式喷发。",
  },
  {
    page: 8,
    title: "火山喷发会带来哪些影响？",
    body: "火山喷发可能带来熔岩流、火山灰、火山气体、泥石流和气候影响。火山灰会影响呼吸、交通和农作物。",
    visual: "火山喷发影响范围图，展示空气、城市、农田和河流。",
  },
  {
    page: 9,
    title: "火山也不全是破坏者",
    body: "虽然火山喷发很危险，但火山活动也可以形成新的土地，带来肥沃的火山土壤、地热资源和矿产资源。",
    visual: "火山喷发后形成新土地、肥沃土壤和地热能的示意图。",
  },
  {
    page: 10,
    title: "我们如何监测火山？",
    body: "科学家会通过地震监测、地表形变监测、气体检测和卫星观测来判断火山是否可能喷发。预警可以帮助人类减少损失。",
    visual: "科学家用仪器、卫星和监测站观察火山变化。",
  },
];

export const quickActions = [
  "改得更生动",
  "缩短每页文字",
  "增加图解感",
  "改成小学生版本",
  "加入真实火山案例",
];
