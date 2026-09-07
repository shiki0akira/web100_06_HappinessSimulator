// 第一關「真幸福」— 拍賣標的與機會命運卡組
// 文案取自執行腳本 v1，請照你們 BEST 的實際處境調整。

export const LOTS = [
  { id: 1, name: '健康的身體' },
  { id: 2, name: '相愛的伴侶' },
  { id: 3, name: '自由的時間' },
  { id: 4, name: '被看見與肯定' },
  { id: 5, name: '有成就感的工作' },
  { id: 6, name: '家庭婚姻美滿' },
  { id: 7, name: '每天睡眠都很好' },
  { id: 8, name: '每天都有好吃的' },
  { id: 9, name: '每天多三小時' },
  { id: 10, name: '成為名人' },
];

// 第一樣是試拍品：不扣點、不計分，只是讓每個人先按過一次出價，
// 真正開始的時候才不會有人還在問「要按哪裡」。
export const PRACTICE_LOT = { id: 0, name: '一杯珍珠奶茶', practice: true };

export const DECKS = {
  // 分組的規則沒變（看剩多少點），但大螢幕上不再說「你是哪一型」——
  // 那個標籤會被當成評語。label／character 只給主持人備忘錄看。
  A: {
    key: 'A',
    label: '甲・花光型',
    short: '花光型',
    rule: '剩 ≤ 20 點',
    character: '身負重擔，心裡沒有盼望。什麼都給出去了，剩下自己一個人撐。',
    cards: [
      { kind: 'hit',  delta: -25, text: '這一年家裡出事。錢、時間、力氣，你都給了。沒有人問過你累不累，你也不知道還要撐多久。' },
      { kind: 'bad',  delta: -16, text: '帳單、房租、孩子的補習費。你算過很多次，就是差那一點。' },
      { kind: 'bad',  delta: -14, text: '你一天最放鬆的時間，是停好車以後在車上坐的那五分鐘。' },
      { kind: 'bad',  delta: -13, text: '你想請一天假。但你請不下去——那一天的事會全部堆到隔天。' },
      { kind: 'bad',  delta: -12, text: '有人問你最近好嗎。你說還好。然後就沒有然後了。' },
      { kind: 'good', delta:  10, text: '你以為撐不過去的那件事，今年真的過去了。' },
      { kind: 'good', delta:   8, text: '有一個人什麼都沒問，只是坐在你旁邊。' },
      { kind: 'good', delta:   8, text: '你堅持了兩年的那件小事，今年做到了。' },
    ],
  },
  B: {
    key: 'B',
    label: '乙・囤積型',
    short: '囤積型',
    rule: '剩 ≥ 60 點',
    character: '條件令人羨慕，心裡卻是空的。',
    cards: [
      { kind: 'hit',  delta: -25, text: '你的條件是很多人羨慕的。可是禮拜天下午一個人在家的時候，你會突然不知道這一切是為了什麼。' },
      { kind: 'bad',  delta: -14, text: '今天發生了一件很好的事。你拿起手機，發現不知道要傳給誰。' },
      { kind: 'bad',  delta: -13, text: '同學會上，大家聊孩子、聊另一半。你聊了工作，然後沒有人接話。' },
      { kind: 'bad',  delta: -12, text: '你買得起那趟旅行。你找不到人一起去。' },
      { kind: 'bad',  delta: -12, text: '別人都說你很成功。你自己知道你不快樂，但你講不出哪裡不對。' },
      { kind: 'good', delta:  12, text: '你幫了一個急需要幫忙的朋友。他在你面前哭了。' },
      { kind: 'good', delta:  10, text: '有一個人是為了你這個人來找你，不是為了你有的東西。' },
      { kind: 'good', delta:   6, text: '你終於買下那個放在購物車三年的東西。它其實沒有很貴。' },
    ],
  },
  C: {
    key: 'C',
    label: '丙・均衡型',
    short: '均衡型',
    rule: '剩 21–59 點',
    character: '一直在追，一直差一點。達不到目標的那種痛。',
    cards: [
      { kind: 'hit',  delta: -22, text: '你設的那個目標，今年又沒有到。你已經記不得這是第幾年了。' },
      { kind: 'bad',  delta: -15, text: '你開始看別人有的——他的房子、他的孩子、他發的那張照片。家裡的人感覺到了。' },
      { kind: 'bad',  delta: -14, text: '你做得很好。所以他們給了你更多。' },
      { kind: 'bad',  delta: -13, text: '你的生活沒有出錯。但你想不起來上一次真的很開心是什麼時候。' },
      { kind: 'bad',  delta: -12, text: '那個位子給了別人。理由聽起來都很合理。' },
      { kind: 'good', delta:  10, text: '孩子跟你說了一句他自己想到的話。你記了很久。' },
      { kind: 'good', delta:   9, text: '一個很久沒聯絡的朋友突然約你吃飯。你們聊到店家打烊。' },
      { kind: 'good', delta:   6, text: '加薪了。不多，但公司記得你。' },
    ],
  },
};


export const VERSE = {
  ref: '馬太福音 11:28',
  text: '凡勞苦擔重擔的人，可以到我這裡來，我就使你們得安息。',
};

