# Mysterium · 古典马赛塔罗 Demo

一个无需安装依赖、可直接运行的三张牌网页原型。

在线体验：[https://old-paper.github.io/mysterium-tarot/](https://old-paper.github.io/mysterium-tarot/)

## 运行

最简单的方法是直接双击 `index.html`。也可以在此目录启动本地静态服务器：

```powershell
python -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 更新网站

本站由 GitHub Pages 从 `main` 分支根目录自动发布。修改完成后，在本目录执行：

```powershell
git add .
git commit -m "描述这次修改"
git push
```

推送完成后，GitHub 会自动重新部署网站。通常稍等片刻即可在上面的在线地址看到更新。

## 当前范围

- 22 张 Jean Dodal 马赛体系大阿卡那
- 来处 / 当下 / 趋向三张牌框架
- 默认默念问题模式，以及可切换的文字输入模式
- 浏览器加密随机数 + Fisher–Yates 洗牌 + 随机切牌
- 可选正逆位
- 逐张翻牌、位置释读、综合线索、复制结果
- 响应式与键盘可访问界面

## 史料边界

- 早期塔罗是 15 世纪欧洲的纸牌游戏，并非有证据支持的古埃及秘典。
- 1783–1784 年 Etteilla 的著作属于可核查的早期塔罗占卜系统文献。
- “来处 / 当下 / 趋向”是现代入门阅读框架，不伪称中世纪古法。
- 牌义是基于图像与当代反思用途的中文整理，不冒充 Etteilla 原文直译。

## 牌面与资料来源

- [OpenGameArt · Jean Dodal Major Arcana](https://opengameart.org/content/tarot-cards-major-arcana) — CC0，约 1701 年的马赛体系图像整理
- [法国国家图书馆 · Jean Dodal, Lyon, 1701](https://catalogue.bnf.fr/ark:/12148/cb391713667)
- [The Metropolitan Museum of Art · Before Fortune-Telling](https://www.metmuseum.org/perspectives/tarot-2)
- [Bibliothèque nationale de France · Etteilla, 1783–1784](https://catalogue.bnf.fr/ark:/12148/cb44214742d)

## 下一阶段建议

1. 扩展为完整 78 张马赛牌，并为数字牌加入基于数与花色结构的解释。
2. 新增 Etteilla 历史模式，与现代马赛阅读模式分开呈现。
3. 增加牌阵、抽牌记录、本地日记与多套牌面。
