/**
 * Chinese Hanzi -> Pinyin Transliteration Engine
 */
export class ChineseProvider {
  private static PINYIN_MAP: Record<string, string> = {
    我: 'wo', 你: 'ni', 他: 'ta', 她: 'ta', 它: 'ta', 们: 'men',
    是: 'shi', 的: 'de', 不: 'bu', 了: 'le', 在: 'zai', 有: 'you',
    人: 'ren', 这: 'zhe', 中: 'zhong', 大: 'da', 来: 'lai', 上: 'shang',
    国: 'guo', 个: 'ge', 到: 'dao', 说: 'shuo', 为: 'wei',
    子: 'zi', 和: 'he', 地: 'di', 出: 'chu',
    也: 'ye', 时: 'shi', 年: 'nian', 得: 'de', 就: 'jiu', 那: 'na',
    要: 'yao', 下: 'xia', 以: 'yi', 生: 'sheng', 会: 'hui', 自: 'zi',
    着: 'zhe', 去: 'qu', 之: 'zhi', 过: 'guo', 家: 'jia', 学: 'xue',
    对: 'dui', 可: 'ke', 里: 'li', 后: 'hou', 小: 'xiao',
    爱: 'ai', 心: 'xin', 天: 'tian', 梦: 'meng', 夜: 'ye', 花: 'hua',
    月: 'yue', 風: 'feng', 雨: 'yu', 星: 'xing', 海: 'hai', 歌: 'ge',
  };

  static romanize(text: string): string {
    if (!text) return text;
    let result = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (this.PINYIN_MAP[char]) {
        result += (result && !result.endsWith(' ') ? ' ' : '') + this.PINYIN_MAP[char];
      } else {
        result += char;
      }
    }

    return result.trim();
  }
}
