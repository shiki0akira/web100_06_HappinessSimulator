// 第一關「真幸福」— 拍賣標的與機會命運卡組
// 文案取自執行腳本 v1，請照你們 BEST 的實際處境調整。

export const LOTS = [
  { id: 1, name: '健康的身體' },
  { id: 2, name: '一段不會走的關係' },
  { id: 3, name: '說走就走的自由' },
  { id: 4, name: '被看見、被肯定' },
  { id: 5, name: '一份有成就感的工作' },
  { id: 6, name: '孩子順利長大' },
  { id: 7, name: '一夜好眠' },
  { id: 8, name: '每天多三小時' },
  { id: 9, name: '一個完全懂你的人' },
];

// 第十樣永遠是「？」，第一關不揭曉（第二關開標時是「永恆」）
export const MYSTERY_LOT = { id: 10, name: '？', mystery: true };

export const DECKS = {
  A: {
    key: 'A',
    label: '甲・花光型',
    rule: '剩 ≤ 20 點',
    character: '什麼都有，就是沒有現金。被錢打。',
    cards: [
      { kind: 'hit',  delta: -25, text: '金融風暴。你把能買的都買了，一點不剩。這一年經濟垮了——你什麼都有，就是沒有一分錢可以撐過去。' },
      { kind: 'bad',  delta: -15, text: '公司調整，你的薪水少了兩成。你這才發現，你一直是月光。' },
      { kind: 'bad',  delta: -14, text: '家裡有人開口跟你借錢。你第一次說不出「好」。' },
      { kind: 'bad',  delta: -12, text: '車子在高速公路上拋錨。修車費你付不出來，只能刷卡分期。' },
      { kind: 'bad',  delta: -12, text: '孩子很想去那個營隊。你算了三次，還是算不出來。' },
      { kind: 'good', delta:  10, text: '你買下的那樣東西，今年真的救了你一次。' },
      { kind: 'good', delta:   8, text: '有人跟你說：你活得很像你自己。' },
      { kind: 'good', delta:   8, text: '你堅持了兩年的那件小事，今年做到了。' },
    ],
  },
  B: {
    key: 'B',
    label: '乙・囤積型',
    rule: '剩 ≥ 60 點',
    character: '數字很好看，日子很空。被人打。',
    cards: [
      { kind: 'hit',  delta: -25, text: '一張檢查報告。你存了一輩子，這次一口氣花完。你買回了命——但那些年，你沒有買過任何別的東西。' },
      { kind: 'bad',  delta: -14, text: '今天發生了一件很好的事。你拿起手機，發現不知道要傳給誰。' },
      { kind: 'bad',  delta: -13, text: '同學會上，大家聊孩子、聊另一半。你聊了股票，然後沒有人接話。' },
      { kind: 'bad',  delta: -12, text: '你的數字很好看。你已經三個週末沒有離開這個房間。' },
      { kind: 'bad',  delta: -12, text: '你買得起那趟旅行。你找不到人一起去。' },
      { kind: 'good', delta:  12, text: '你幫了一個急需用錢的朋友。他在你面前哭了。' },
      { kind: 'good', delta:  10, text: '裁員名單出來的那天晚上，你睡得比同事好。' },
      { kind: 'good', delta:   6, text: '你終於買下那個放在購物車三年的東西。它其實沒有很貴。' },
    ],
  },
  C: {
    key: 'C',
    label: '丙・均衡型',
    rule: '剩 21–59 點',
    character: '什麼都有一點，也都不多。被比較打。',
    cards: [
      { kind: 'hit',  delta: -22, text: '你什麼都有一點，也都不多。你開始看別人有的——他的房子、他的孩子、他發的那張照片。家裡的人感覺到了。' },
      { kind: 'bad',  delta: -14, text: '你們沒有吵架。只是他回家以後，話越來越少。' },
      { kind: 'bad',  delta: -13, text: '你的生活沒有出錯。但你想不起來上一次真的很開心是什麼時候。' },
      { kind: 'bad',  delta: -12, text: '體檢報告有一個紅字。醫生說先追蹤。你查了三天網路。' },
      { kind: 'bad',  delta: -12, text: '你做得很好。所以他們給了你更多。' },
      { kind: 'good', delta:  10, text: '孩子跟你說了一句他自己想到的話。你記了很久。' },
      { kind: 'good', delta:   9, text: '一個很久沒聯絡的朋友突然約你吃飯。你們聊到店家打烊。' },
      { kind: 'good', delta:   6, text: '加薪了。不多，但公司記得你。' },
    ],
  },
};

// 問號卡：不加不扣，第一關完全不解釋。第五關「當上帝來敲門」會把它調出來。
export const QUESTION_CARDS = [
  { kind: 'question', delta: 0, text: '那段最難的日子，有一個人一直在。你不知道為什麼是他。' },
  { kind: 'question', delta: 0, text: '有一件事，本來可以更糟。但它沒有。' },
];

export const VERSE = {
  ref: '馬太福音 11:28',
  text: '凡勞苦擔重擔的人，可以到我這裡來，我就使你們得安息。',
};

