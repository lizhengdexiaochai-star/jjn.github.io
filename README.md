# 商机管家 v3.0 · LED 光电销售客户商机管理

手机优先的客户关系管理（CRM）应用：**客户表 · 商机表 · 跟进记录表** 三张真正的表格 + 7 列拖拽看板 + 拜访照片 + 阶段自动提醒 + 成交统计。

> 无需安装、无需账号。客户资料保存在浏览器本地，照片单独存放在 IndexedDB，可导出完整 JSON 备份。

---

## 🚨 先看：GitHub Pages 上「打不开 / 没有数据」的原因

线上当前部署的根目录 `index.html` 是**多文件版入口**，它引用同目录的 `style.css` / `app.js`，但这两个文件在仓库根目录不存在（实测均返回 404）。结果就是：只剩静态标题和底部导航，脚本不执行，所以看起来「不能建表、没有数据」。

**修复方式：** 上传 `deploy-github-pages/` 里的文件到仓库根目录，至少覆盖 `index.html`。

- 只上传 `deploy-github-pages/index.html` → 应用完整可用（单文件自包含），但没有离线缓存和 PWA 安装。
- 上传整个 `deploy-github-pages/`（`index.html` + `sw.js` + `manifest.webmanifest` + `icons/`）→ 应用可用 + 离线打开 + 可安装到主屏幕。

详见 [deploy-github-pages/README.md](deploy-github-pages/README.md)。

---

## 📸 界面预览

| 首页 | 客户表（表格视图） | 商机看板 |
| --- | --- | --- |
| ![首页](screenshots/home.png) | ![客户表](screenshots/customers.png) | ![商机看板](screenshots/opps.png) |

| 商机表（表格视图） | 跟进表（表格视图） | 我的 |
| --- | --- | --- |
| ![商机表](screenshots/opps-table.png) | ![跟进表](screenshots/records.png) | ![我的](screenshots/more.png) |

| 新增跟进（含照片/提醒） | 新增客户 |
| --- | --- |
| ![新增跟进](screenshots/record-form.png) | ![新增客户](screenshots/customer-form.png) |

---

## ✨ v3.0 主要变化

### 1. 三张真正的表格视图（不是只有卡片）
- **客户**：卡片 / 表格切换
- **商机**：看板 / 列表 / 表格切换
- **跟进**：时间线 / 表格切换
- 表格带表头、列标题、横向滑动提示、首列冻结、键盘可聚焦；「我的」里仍可导出三张 CSV。

### 2. 数据安全（针对“丢一天工作”的根因）
- 文字数据与照片分离：文字在 `localStorage`（键 `shangji-crm-v3`），照片在 IndexedDB，不再挤占 5MB 配额。
- 保存失败不再只弹一次 toast：顶部常驻红色告警 + “立即导出备份 / 重试保存”，并阻止页面关闭时不提醒。
- 本地数据损坏：**不会**静默降级为空库；原始串备份到 `shangji-crm-v3.corrupt.<时间>`，弹窗可下载原始数据或从自动快照恢复。
- 自动快照：IndexedDB 保留最近 8 份文字快照（约 6 小时一次；导入/删除前会先拍一份；清空全部数据会连快照一起删除），可在「我的 → 自动快照与恢复」找回。
- 30 天未导出备份时，首页/我的显示备份提醒。

### 3. 修掉会白干一天的功能 Bug
- 列表视图点「下一阶段 / 上一阶段」不再同时弹出编辑窗、不再把阶段改回去。
- 照片压缩改成可等待流程：处理中禁用“保存”，处理失败逐张提示（HEIC/损坏图不再静默成功）。
- 第 5 张之后的照片：`+N` 可点，打开完整照片浏览（上一张/下一张/缩略图）。
- 提醒精确到分钟；支持浏览器通知（页面打开时）和 `.ics` 导出到手机日历；提醒与客户/商机联动，改客户会同步，删客户/商机/记录会清理。
- 拖拽不再静默改“丢单”状态、不再清空历史成交日期；恢复丢单商机会二次确认。
- 负责人被删除后，编辑旧记录不会被静默改成“我”，会保留“（已移除）”选项。
- “最近跟进”改为从全部记录重新计算，删掉最新记录会回退。
- 统计口径：成交率 = 签单 ÷（签单 + 丢单）；本月签单只认 `winAt`，编辑旧商机不会算进本月；0 元显示“0 万”而不是“—”。

### 4. 安全
- **所有**用户内容（含照片 data URL、跟进时间）写入页面前转义；照片只接受 `data:image/(jpeg|png|webp|gif);base64`，构造的备份无法注入脚本。
- CSP 从 `'unsafe-inline'` 改为**单文件内联脚本/样式哈希**（`script-src 'sha256-…'`），不再允许任意内联脚本。
- CSV 公式注入防护（`= + - @` 开头加 `'` 前缀）。
- 导入备份按字段白名单重建对象，限制数组/照片/文本长度，非法 ID 重新生成，防止原型污染和超大数据。

### 5. 部署 / PWA / 可维护性
- 新增构建脚本：一次生成单文件版和 GitHub Pages 部署包，构建号改为**内容哈希**（“我的”页显示），不再手写 `BUILD_TIME` 判断部署版本。
- `sw.js` 导航请求网络优先，静态资源缓存优先，部署更新后不会长期卡旧版；离线可打开。
- 真正的 `manifest.webmanifest` + 180/192/512/maskable 图标，iOS 添加到主屏幕有正确图标。
- schema 版本号 + 顺序迁移（v1 → v2 → v3）；迁移成功后删除旧键，不会“删掉的数据复活”。
- 按页渲染（dirty page）+ 搜索防抖，不再每敲一个字重建五个区块，也不会重置「我的」页 `<details>` 展开状态。
- 无障碍：弹窗 `role="dialog"`、焦点陷阱、ESC 关闭、`aria-live` toast、图标按钮 `aria-label`、表格 `caption/scope`、恢复双指缩放。

---

## 📱 使用方式

### 方式 A：本地双击（最简单）
双击 `商机管家-单文件版.html`。样式、脚本、图标全部内嵌，不依赖同目录文件。

> 多文件版 `index.html` 需要同目录的 `style.css` / `app.js`，适合开发调试；不建议单独拷走。

### 方式 B：局域网手机访问
双击 `启动服务器.bat`，手机访问 `http://电脑IP:8000`。

### 方式 C：GitHub Pages / 任意静态托管（公网）
把 `deploy-github-pages/` **里面的内容**上传到站点根目录：

```
index.html
sw.js
manifest.webmanifest
icons/icon-180.png
icons/icon-192.png
icons/icon-512.png
icons/icon-512-maskable.png
.nojekyll
```

只上传 `index.html` 也能用，但离线/PWA 不完整。详细步骤与排查见 [deploy-github-pages/README.md](deploy-github-pages/README.md)。

---

## 🧩 功能一览

| 模块 | 功能 |
| --- | --- |
| 首页 | 本月签单金额、进行中商机、本月跟进、成交率；到期/7 天内提醒；最近跟进；三张表快捷入口 |
| 客户 | 编号自动、名称、行业、地址、联系人/职位、电话、微信、邮箱、来源、负责人、等级 A/B/C/D、备注、最近跟进；卡片/表格 |
| 商机 | 编号自动、关联客户、名称、7 阶段、预估/成交金额（万元）、预计成交、品类、竞品、状态、丢单原因、负责人、阶段历史；看板/列表/表格 |
| 跟进 | 关联客户/商机、类型、时间、内容、反馈、下次计划、**分钟级提醒**、拜访照片（多张/压缩/浏览）、跟进人；时间线/表格 |
| 我的 | 成交统计、成员管理、完整 JSON 备份（含照片）、CSV 三表导出、自动快照、日历导出、浏览器通知、诊断、示例数据 |

### 阶段自动提醒
- 意向 → 5 天后推进方案
- 报价 → 3 天后跟进报价反馈
- 投标 → 2 天后跟进投标进展
- 签单 → 7 天后回访

提醒在首页“待跟进提醒”出现；可导出 `.ics` 到手机日历（带提前 30 分钟闹钟）。

---

## 💾 数据说明

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 客户/商机/跟进/提醒/设置 | `localStorage` 的 `shangji-crm-v3` | 纯文字，体积小 |
| 拜访照片 | IndexedDB `shangji-crm-store` / `photos` | 不占 localStorage 5MB 配额 |
| 自动快照 | IndexedDB `shangji-crm-store` / `snapshots` | 最近 8 份文字快照，不含照片 |
| 旧版数据 | `shangji-crm-v2` / `shangji-crm-db-v1` | 首次打开自动迁移，成功后删除旧键 |

- 数据不上传任何服务器，应用没有网络请求。
- 清理浏览器数据 / 换手机 / 换浏览器 / 无痕模式都会丢失，请定期「导出完整备份（JSON，含照片）」。
- 不同设备不互通：旧设备导出 → 新设备导入。
- **隐私提醒**：`github.io` 是共享域名，同一账号下所有仓库页面属于同一个浏览器源，技术上可读取本应用的 localStorage。若同账号下还有不受信任的页面，建议为本应用单独建账号/组织，或绑定独立域名。

---

## 📂 文件结构

```
crm-app/
├── index.html                    多文件版入口（开发/本地服务器）
├── app.js                        业务逻辑（唯一源码）
├── style.css                     样式
├── 商机管家-单文件版.html         ★ 构建产物：完全自包含
├── deploy-github-pages/           ★ 构建产物：GitHub Pages 部署包
│   ├── index.html                自包含页面（只传这个也能用）
│   ├── sw.js                     离线缓存
│   ├── manifest.webmanifest      PWA
│   ├── icons/                    图标
│   └── build-info.json           构建号/哈希/大小
├── scripts/
│   ├── build.js                  构建（单文件 + 部署包 + CSP hash）
│   ├── build_single.js           兼容旧命令
│   ├── smoke_test.js             Node 逻辑测试
│   ├── browser-test.html         浏览器交互测试
│   ├── state-test.html           损坏数据/迁移测试
│   ├── visual.html               截图用页面
│   └── make_icons.py             图标生成
├── screenshots/                  真实浏览器截图
├── 安全自检报告.md
├── 修复报告-v3.md                26 项问题逐条对照
├── manifest.webmanifest / sw.js  源文件
├── icons/
└── 启动服务器.bat
```

---

## 🛠 构建

需要 Node.js（任意较新版本）：

```bash
node scripts/build.js
```

输出：

- `商机管家-单文件版.html`
- `deploy-github-pages/index.html`（自包含）
- `deploy-github-pages/sw.js`（注入构建号）
- `deploy-github-pages/icons/`、`manifest.webmanifest`、`build-info.json`、`.nojekyll`

构建会：
1. 用内容哈希生成构建号（“我的”页显示）；
2. 内联 CSS/JS，并计算 CSP `sha256` 哈希；
3. 校验 `</script>` / `</style>` 注入风险；
4. 写出单文件版和部署包。

> 请勿手工修改 `商机管家-单文件版.html` / `deploy-github-pages/index.html`，改 `app.js` / `style.css` / `index.html` 后重新构建。

## 🧪 测试

```bash
# Node 逻辑测试（45 项）
node scripts/smoke_test.js

# 需要本地 HTTP 服务 + Edge/Chrome 无头模式：
#   /scripts/browser-test.html   交互、表格、XSS、保存失败（41 项）
#   /scripts/state-test.html     损坏数据、v1/v2 迁移（16 项）
#   node scripts/cdp_test.js     真实 IndexedDB 照片、SW、离线（13 项）
```

测试结果见 `修复报告-v3.md`。截图见 `screenshots/`。

---

## ⚠️ 已知限制

- 浏览器通知只能在**页面打开时**触发；真正的后台提醒请用「导出提醒到日历（.ics）」导入系统日历。
- 照片依赖 IndexedDB；极老旧浏览器/部分无痕模式不可用，此时文字数据仍正常。
- 同一 `github.io` 账号下的其他页面理论上可读本应用的本地数据；介意请用独立账号/域名。
- 数据明文保存在本机，不加密；能拿到设备/浏览器配置的人可以读取。

---

商机管家 v3.0 · 构建号见「我的」页或 `deploy-github-pages/build-info.json` · 数据仅存本机浏览器
