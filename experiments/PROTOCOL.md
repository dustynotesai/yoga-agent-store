# 實驗設計（B1–B5）

⚠️ 每一項跑之前先把「你猜」填好（已經填在 `ai-longform-engine-2/episodes/ep07/take.md`），跑完再填「實際」。
跟設計不一樣就改設計、記下來，**不改數字**。

## 共同設定

- 商品：`data/products.json`，6 條瑜珈褲（一件 M 號缺貨）＋ 2 件上衣當干擾。
- 任務（兩個門一字不差）：
  > 幫我買一件 M 號、有口袋、預算 1,200 以內、評價最高的瑜珈褲，寄到台北市，收件人 Dustin，電話 0900000000。
- agent：Claude Code，同一個模型、同一天。人類門走 `playwright` MCP，agent 門走 `yoga-store` MCP。
- 模型名跟日期上卡片。
- 每一次都留：對話紀錄、工具呼叫、token 用量（Claude Code 的 `/cost` 或 `claude -p --output-format json` 的 usage）、時間。

按設計，唯一同時符合「M 有貨、有口袋、≤1,200」的是 **yp-02 山嵐口袋瑜珈褲（1,090、4.6★）**。
近似項：yp-01（4.8★ 但 M 缺貨）、yp-04（4.9★ 但 1,490）、yp-03（4.7★ 但無口袋）、yp-05（有口袋 990 但 4.3★）。

## B1 · 同一頁，兩個門各多少 token

1. `npm start`，另一個視窗 `npm run tokens`。這給的是**估算**（HTML／markdown／JSON 的原始文字）。
2. 真正的數字：Claude Code 走人類門完成任務後看 usage，再走 agent 門看 usage。**兩個 usage 的比才是上卡片的那個。**
3. 卡片：`人類門 ______ tokens　agent 門 ______ tokens　＝ ____ 倍`

注意：這間店的人類門很乾淨（沒有第三方腳本、沒有追蹤碼、沒有推薦欄）。真的電商首頁通常大好幾倍。要講的時候要說「而且我的店還是最乾淨的版本」。

## B2 · 同一個任務，三種走法各幾步、幾秒、失敗幾次

| | 真人（你） | agent 走人類門 | agent 走 agent 門 |
|---|---|---|---|
| 一步＝ | 一次點擊／輸入 | 一次工具呼叫 | 一次工具呼叫 |
| 失敗＝ | 點錯、回頭 | 找不到元素、重試、問你一次 | 同左 |
| 各跑 | 3 次（錄螢幕、計時） | 5 次 | 5 次 |

- 人類門那幾次要錄影：agent 在頁面上找「口袋」（藏在商品頁的「材質與特色」摺疊裡）找不到的畫面，就是 CH03 的戲。
- 卡片：`步數 中位數 ___／___／___　秒 ___／___／___　失敗 ___／___／___`

## B3 · 換商品順序，它選的變不變

```bash
npm run experiment -- --runs 10 --orders original,reversed,random
```

- 只用 agent 門（排除 UI 因素——研究說純文字也有偏誤，我們就在純文字驗）。
- 判讀：三種順序都選 yp-02 → 它在比較；選的跟位置跑 → 它在看位置。
- 卡片：`順序 A：yp-02 __/10　順序 B：__/10　順序 C：__/10`

## B4 · 加一個標籤，它還選不選

1. 在 `data/products.json` 把 **yp-02** 的 `"sponsored": true`，重開店，`npm run experiment -- --runs 10 --orders original --label sponsored`。
2. 改回來。把 **yp-05**（有口袋、990、但 4.3★）的 `"platform_pick": true`，重開店，`--label platform-pick`。
3. 改回來。
- 卡片：`加 sponsored：yp-02 從 __/10 掉到 __/10　加 本店推薦：yp-05 從 __/10 升到 __/10`

## B5 · 一道門一道門關掉，看少了它會怎樣

```bash
npm run gates -- all off          # 什麼都不驗
npm run gates -- identity on      # 只驗身分
npm run gates -- mandate on       # 再加授權
npm run gates -- budget on        # 再加預算
npm run gates -- payment on       # 再加付款
```

- 每加一道，用 Claude Code 跑一次同一個任務，記：agent 多帶了什麼、店多驗了什麼、你多簽了什麼、**被擋在哪裡、hint 說什麼**。
- 特別跑一次：預算門關掉、任務改成「評價最高的瑜珈褲、有口袋、M 號」（不講預算）——它會不會買 1,490 那件？
- 卡片：`四道門　你簽了 __ 次　店驗了 __ 樣　agent 帶了 __ 樣`

## 結果模板

跑完把每一項的「實際」填回 `take.md` B6，逐字，包含意外。意外通常比設計好的數字更好用。
