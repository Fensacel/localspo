import * as wanakana from 'wanakana';

/**
 * Japanese Kana & Kanji Hepburn Romanization Engine
 * Uses Wanakana for Kana + High-coverage Japanese Kanji reading map
 */
export class JapaneseProvider {
  private static COMPOUND_MAP: Record<string, string> = {
    通り雨: 'tooriame',
    通り雨が: 'tooriame ga',
    通り雨と: 'tooriame to',
    木漏れ日: 'komorebi',
    名乗る: 'nanoru',
    居たんだろう: 'itan darou',
    居た: 'ita',
    前から: 'mae kara',
    引き換え: 'hikikae',
    引き換えに: 'hikikae ni',
    繋ぎ合う: 'tsunagiau',
    魅せられて: 'miserarete',
    重ねる: 'kasaneru',
    重ねるのは: 'kasaneruno wa',
    それでも: 'soredemo',
    私達: 'watashitachi',
    僕達: 'bokutachi',
    あなた: 'anata',
    ずっと: 'zutto',
    背中: 'senaka',
    思い浮かべる: 'omoi ukaberu',
    浮かべる: 'ukaberu',
    憧れ: 'akagare',
    知っていながら: 'shitteinagara',
    叶わぬ: 'kanawanu',
    世界: 'sekai',
    未来: 'mirai',
    過去: 'kako',
    永遠: 'eien',
    刹那: 'setsuna',
    仲間: 'nakama',
    友達: 'tomodachi',
    約束: 'yakusoku',
    記憶: 'kioku',
    思い出: 'omoide',
    運命: 'unmei',
    奇跡: 'kiseki',
    希望: 'kibou',
    絶望: 'zetsubou',
    情熱: 'jounetsu',
    衝動: 'shoudou',
    真実: 'shinjitsu',
    現実: 'genjitsu',
    理想: 'risou',
    幻想: 'gensou',
    太陽: 'taiyou',
    月光: 'gekkou',
    流星: 'ryuusei',
    銀河: 'ginga',
    宇宙: 'uchuu',
    微笑み: 'hohoemi',
    優しさ: 'yasashisa',
    切なさ: 'setsunasa',
    言葉: 'kotoba',
    心臓: 'shinzou',
    鼓動: 'kodou',
    大丈夫: 'daijoubu',
    ありがとう: 'arigatou',
    さよなら: 'sayonara',
    一番: 'ichiban',
    最後: 'saigo',
    最初: 'saisho',
    昨日: 'kinou',
    今日: 'kyou',
    明日: 'ashita',
    今年: 'kotoshi',
    毎日: 'mainichi',
    今夜: 'konya',
    今夜は: 'konya wa',
    今でも: 'ima demo',

    // New compounds
    重力: 'juuryoku',
    一度: 'ichido',
    対角線: 'taikakusen',
    対角: 'taikaku',
    目が覚めた: 'mega sameta',
    目が覚める: 'mega sameru',
    覚めた: 'sameta',
    連れ戻せ: 'tsuremodose',
    場所: 'basho',
    大地: 'daichi',
    切れ間: 'kirema',
    出発点: 'shuppatsuten',
    出発: 'shuppatsu',
    終点: 'shuuten',
    果てる: 'hateru',
    言い張る: 'iiharu',
    言い張って: 'iihatte',
    語り方: 'katarikata',
    砂時計: 'sunadokei',
    美しく: 'utsukushiku',
    父親: 'chichioya',
    笑顔: 'egao',
    何故: 'naze',

    // Custom additions for common lyrics vocabulary
    眠りにつく: 'nemuri ni tsuku',
    眠り: 'nemuri',
    立ち: 'tachi',
    出よう: 'deyou',
    目が覚めたとき: 'mega sameta toki',
    覚めたとき: 'sameta toki',
    連れ戻せぬ: 'tsuremodosenu',
    連れ戻せぬ場所: 'tsuremodosenu basho',
    蹴って: 'kette',
    止む: 'yamu',
  };

  private static KANJI_MAP: Record<string, string> = {
    通: 'too', 漏: 'mo', 名: 'na', 乗: 'no', 前: 'mae', 居: 'i',
    木: 'ko', 日: 'hi', 雨: 'ame', 空: 'sora', 飛: 'tobi', 羽: 'hane', 根: 'ne',
    引: 'hiki', 換: 'kae', 繋: 'tsuna', 合: 'a', 手: 'te', 選: 'era', 僕: 'boku',
    魅: 'mi', 夢: 'yume', 重: 'juu', 罪: 'tsumi', 愛: 'ai', 心: 'kokoro', 君: 'kimi',
    私: 'watashi', 今: 'ima', 夜: 'yoru', 月: 'tsuki', 星: 'hoshi', 風: 'kaze',
    海: 'umi', 花: 'hana', 光: 'hikari', 影: 'kage', 声: 'koe', 歌: 'uta', 音: 'oto',
    道: 'michi', 命: 'inochi', 生: 'iki', 死: 'shi', 時: 'toki', 千: 'sen', 万: 'man',
    一: 'ichi', 二: 'ni', 三: 'san', 四: 'yon', 五: 'go', 六: 'roku', 七: 'nana', 八: 'hachi', 九: 'kyuu', 十: 'juu',
    目: 'me', 耳: 'mimi', 口: 'kuchi', 足: 'ashi', 头: 'atama', 頭: 'atama', 神: 'kami',
    世: 'yo', 界: 'kai', 涙: 'namida', 笑: 'wara', 泣: 'naki', 想: 'omoi',
    思: 'omoi', 知: 'shi', 言: 'i', 見: 'mi', 聞: 'ki', 走: 'hashi', 歩: 'aru',
    泳: 'oyo', 開: 'hira', 閉: 'toji', 始: 'haji', 終: 'owa', 探: 'saga',
    忘: 'wasure', 覚: 'obe', 抱: 'daka', 守: 'mamo', 壊: 'kowa', 願: 'nega',
    祈: 'ino', 信: 'shin', 許: 'yuru', 踊: 'odo', 奏: 'kana', 響: 'hibi',
    輝: 'kagaya', 煌: 'kirame', 閃: 'hira', 炎: 'honoo', 火: 'hi', 水: 'mizu',
    金: 'kane', 土: 'tsuchi', 天: 'ten', 地: 'chi', 川: 'kawa', 山: 'yama',
    森: 'mori', 林: 'hayashi', 雲: 'kumo', 雪: 'yuki', 霜: 'shimo', 霧: 'kiri',
    嵐: 'arashi', 雷: 'kaminari', 電: 'den', 闇: 'yami', 朝: 'asa', 昼: 'hiru',
    夕: 'yuu', 晩: 'ban', 春: 'haru', 夏: 'natsu', 秋: 'aki', 冬: 'fuyu', 昔: 'mukashi',
    人: 'hito', 女: 'onna', 男: 'otoko', 子: 'ko', 母: 'haha', 父: 'chichi', 兄: 'ani',
    弟: 'otouto', 姉: 'ane', 妹: 'imouto', 家: 'ie', 街: 'machi', 国: 'kuni',
    旅: 'tabi', 翼: 'tsubasa', 鳥: 'tori', 背: 'se', 中: 'naka', 顔: 'kao',
    浮: 'uka', 憧: 'akagare', 恋: 'koi', 叶: 'kana', 傘: 'kasa', 晴: 'hare',
    
    // New individual Kanji
    力: 'ryoku',
    角: 'kaku',
    立: 'ta',
    出: 'de',
    連: 'tsu',
    戻: 'modo',
    场: 'ba',
    場: 'ba',
    所: 'sho',
    蹴: 'ke',
    大: 'dai',
    度: 'do',
    年: 'nen',
    止: 'to',
    切: 'ki',
    間: 'ma',
    点: 'ten',
    発: 'hatsu',
    何: 'nani',
    張: 'ba',
    眠: 'nemu',
    彼: 'kare',

    // Full-width numbers
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  };

  static romanize(text: string): string {
    if (!text) return text;
    let i = 0;
    const tokens: string[] = [];

    while (i < text.length) {
      const char = text[i];
      if (/\s/.test(char) || /[?,.!〜…〜-]/.test(char)) {
        tokens.push(char);
        i++;
        continue;
      }

      // 1. Compound phrases up to 8 chars
      let matched = false;
      for (let len = 8; len >= 2; len--) {
        if (i + len <= text.length) {
          const phrase = text.slice(i, i + len);
          if (this.COMPOUND_MAP[phrase]) {
            tokens.push(this.COMPOUND_MAP[phrase]);
            i += len;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // 2. Single char: Mapped Kanji or Wanakana Kana
      if (this.KANJI_MAP[char]) {
        tokens.push(this.KANJI_MAP[char]);
      } else {
        tokens.push(wanakana.toRomaji(char));
      }
      i++;
    }

    let result = tokens.join(' ').replace(/\s+/g, ' ').trim();
    if (result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  }

  static async romanizeAsync(text: string): Promise<string> {
    return this.romanize(text);
  }
}
