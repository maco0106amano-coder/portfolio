# KakeMochin（Web版）

掛け持ちバイトの学生向けシフト・収入管理アプリ「かけもちん」のブラウザ版です。
元の SwiftUI 版（`D:\KakeMochin\KakeMochin.swiftpm`、iPhone・iPad向け）と同じ計算ルールで、WindowsやAndroidのブラウザでも動きます。

- 画面: Calendar／Home／Settings の3タブ（元アプリと同じ）
- データ: このブラウザの中だけに保存（localStorage）。ログイン・通信なし。別の端末とは同期しない
- 給料 = 時給 × 実働時間（休憩を引く）。終了が開始より前なら翌日に終わる夜勤として計算
- 深夜手当・交通費・税金は計算しない
- 初回はサンプルデータが入る（Settings → Erase All Data で消せる）

## 開き方

`index.html` をブラウザで開くだけで動きます。HTTPSで公開すると、ホーム画面に追加してオフラインでも開けます。
