// Lightweight, deterministic classification for existing posts and newly imported posts.
// Users can override both axes in the post detail dialog.
export const FORMATS = ['未分類','予想＋質問','質問型','予想型','意見型','速報型','記事紹介型','試合振り返り','その他'];
export const TOPICS = ['首脳陣','12球団','ドラフト','契約・移籍','若手育成','試合','データ・記録','その他'];

export function classify(text) {
  const s=String(text??'').normalize('NFKC');
  const question=/[?？]|どう思|皆さん|みなさん|教えて|どっち|どちら|好きな|どうでしょう|思いますか|予想して|誰がいい/.test(s);
  const prediction=/予想|想定|構想|候補|こうなりそう|なると思う|可能性|予測|来季の.*(打線|布陣|スタメン)/.test(s);
  let category='その他';
  if(prediction&&question)category='予想＋質問';
  else if(question)category='質問型';
  else if(prediction)category='予想型';
  else if(/振り返|総括|勝因|敗因|試合後|敗戦分析|連戦の結果/.test(s))category='試合振り返り';
  else if(/速報|正式発表|決定しました|決定した|発表されました|公示|発表！|発表!/.test(s))category='速報型';
  else if(/記事|スポーツ報知|報じ|ニュース|リンク|データを公開|掲載|紹介します/.test(s))category='記事紹介型';
  else if(/思う|考え|期待|すべき|個人的|自分は|賛成|反対|してほしい|したい|評価/.test(s))category='意見型';

  let topic='その他';
  if(/首脳陣|監督|ヘッドコーチ|打撃コーチ|投手コーチ|コーチ陣|CBO|GM|指導者/.test(s))topic='首脳陣';
  else if(/ドラフト|指名|競合|ドラ1|ドラフト1位|ドラフト候補/.test(s))topic='ドラフト';
  else if(/戦力外|自由契約|育成打診|支配下契約|契約更改|FA\b|トレード|移籍|獲得|退団|入団/.test(s))topic='契約・移籍';
  else if(/若手|育成|成長|覚醒|ファーム|2軍|二軍|3軍|三軍|新人|ルーキー/.test(s))topic='若手育成';
  else if(/日本シリーズ|クライマックス|\bCS\b|試合|先発|スタメン|打線|勝利|敗戦|得点|連戦|延長|投手交代/.test(s))topic='試合';
  else if(/打率|防御率|OPS\b|WAR\b|記録|成績|本塁打|ホームラン|HR\b|奪三振|分析|データ|盗塁数/.test(s))topic='データ・記録';
  else if(/巨人|ジャイアンツ|阪神|中日|ヤクルト|横浜|DeNA|広島|カープ|オリックス|ソフトバンク|西武|楽天|ロッテ|日本ハム|ファイターズ/.test(s))topic='12球団';
  return {category,topic};
}
