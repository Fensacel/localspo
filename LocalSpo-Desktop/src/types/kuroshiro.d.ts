declare module 'kuroshiro' {
  export default class Kuroshiro {
    constructor();
    init(analyzer: any): Promise<void>;
    convert(str: string, options?: { to?: string; mode?: string; romajiSystem?: string }): Promise<string>;
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
  export default class KuromojiAnalyzer {
    constructor(options?: { dictPath?: string });
  }
}
