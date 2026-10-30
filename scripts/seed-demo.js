/**
 * 截圖與測試用的示範資料。歌詞、作品名稱全是自己編的，不是真的音樂劇（repo 是公開的）。
 */
const iso = (min) => new Date(Date.UTC(2026, 9, 1, 0, min)).toISOString();

const S1 = `[MIRA]
The harbor wakes before the sun,
I yearn for roads I've never run.
Hold on, hold on, the tide will turn,
There's still a lantern left to burn.

[TOMAS & MIRA]
And if the morning finds me here,
I'll trade my silence for a cheer.
Don't let the shadows steal your song,
We've waited for this day so long.`;

const S1_ZH = `港口在太陽升起前醒來，
我渴望那些從沒跑過的路。
撐住，撐住，潮水會轉向，
還有一盞燈籠等著點亮。

如果清晨發現我還在這裡，
我會用沉默換一聲歡呼。
別讓陰影偷走你的歌，
這一天我們等了好久。`;

const S2 = `Little light, don't you fade away,
Stay with me till the break of day.
I was dreamin' of a brighter shore,
Knockin' gently at an open door.

Hold on, little light, hold on,
The night is long but it won't be long.`;

const S3 = `Take a bow, the curtain falls,
Echoes dancing down the halls.
Every heartbeat, every line,
For a moment, all was mine.`;

// 故意少一行：測「行數對不上就分開顯示」
const S3_ZH = `鞠躬吧，布幕落下，
回聲在走廊裡跳舞。
那一刻，一切都屬於我。`;

const S4 = `We built a kingdom out of glue,
With paper crowns for me and you.`;

module.exports = {
  works: [
    { id: 'wA', name: 'Lantern Road', order: 1, createdAt: iso(1) },
    { id: 'wB', name: 'Paper Crowns', order: 2, createdAt: iso(2) }
  ],
  songs: [
    { id: 's1', workId: 'wA', title: 'Morning on the Pier', order: 1, lyrics: S1, translation: S1_ZH, createdAt: iso(3) },
    { id: 's2', workId: 'wA', title: 'Little Light', order: 2, lyrics: S2, translation: '', createdAt: iso(4) },
    { id: 's3', workId: 'wA', title: 'Curtain Call', order: 3, lyrics: S3, translation: S3_ZH, createdAt: iso(5) },
    { id: 's4', workId: 'wB', title: 'Kingdom of Glue', order: 1, lyrics: S4, translation: '', createdAt: iso(6) }
  ],
  words: [
    { id: 'k1', text: 'yearn', kind: 'word', zh: '渴望', kk: '[jɝn]', note: 'yearn for + 名詞：渴望得到…', status: 'learning', songId: 's1', createdAt: iso(10) },
    { id: 'k2', text: 'hold on', kind: 'phrase', zh: '撐住；等一下', kk: '', note: '', status: 'learning', songId: 's1', createdAt: iso(11) },
    { id: 'k3', text: 'tide', kind: 'word', zh: '潮水；趨勢', kk: '[taɪd]', note: 'the tide will turn：情勢會好轉', status: 'learning', songId: 's1', createdAt: iso(12) },
    { id: 'k4', text: 'lantern', kind: 'word', zh: '燈籠；提燈', kk: '[ˋlæntɚn]', note: '', status: 'known', songId: 's1', createdAt: iso(13) },
    { id: 'k5', text: 'shore', kind: 'word', zh: '岸；海岸', kk: '[ʃor]', note: '', status: 'learning', songId: 's2', createdAt: iso(14) },
    { id: 'k6', text: 'fade away', kind: 'phrase', zh: '逐漸消失', kk: '', note: '', status: 'learning', songId: 's2', createdAt: iso(15) },
    { id: 'k7', text: "dreamin'", kind: 'word', zh: '做夢（dreaming 的口語寫法）', kk: '[ˋdrimɪn]', note: '', status: 'learning', songId: 's2', createdAt: iso(16) },
    { id: 'k8', text: 'curtain call', kind: 'phrase', zh: '謝幕', kk: '', note: '歌名，歌詞裡沒有', status: 'learning', songId: 's3', createdAt: iso(17) }
  ],
  meanings: [
    { id: 'k2__s1', wordId: 'k2', songId: 's1', text: '撐下去，別放棄', createdAt: iso(20) },
    { id: 'k3__s1', wordId: 'k3', songId: 's1', text: '局勢（the tide will turn 時來運轉）', createdAt: iso(21) }
  ]
};
