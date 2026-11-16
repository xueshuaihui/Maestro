# I1.10b 需求快评 · `requirement.md` v6（相对 v5 HEAD `c0e46aa`）

- **评审角色**：需求快评 Agent（干净上下文、只读、v6 专项）
- **评审对象**：`docs/iterations/iteration-10b/requirement.md`（工作区 v6）
- **基线**：`c0e46aaa90cd184851dabc5471e81d19d76dd658`（= 当前 HEAD，`git merge-base --is-ancestor` 确认存在且为 HEAD）
- **唯一可写文件**：本文件；未改需求、实现、测试；未采信修订 Agent 自述，全部自跑命令

---

## §0 总判

**PASS**。五条判据逐条全绿；**无阻断项**。准 S2 继续。

---

## §1 五条判据逐条证据

### 判据 1 · v6 diff 只落在允许范围 —— PASS

命令：`git diff c0e46aa -- docs/iterations/iteration-10b/requirement.md`

全文 diff 仅 3 个 hunk（`git diff --numstat`：`10  1`）：

| hunk | 位置 | 性质 | 判定 |
|---|---|---|---|
| `@@ -4,7 +4,7 @@` | 头部第 7 行 | `版本 v5 → v6` | 允许（头部版本行） |
| `@@ -1470,6 +1470,7 @@` | 第 1473 行 | 附录 C 新增 1 行 v6 变更记录 | 允许（附录 C 新增 v6 行） |
| `@@ -1601,6 +1602,14 @@` | 第 1605–1612 行 | 附录 D-11 新增 `errors.test.js`、`http-channel.test.js` 两处授权 + 理由/范围澄清 | 允许（D-11 新增两处授权） |

- 删行仅 1 行：即 `**版本**：v5`，被 `v6` 替换；无其它删除。
- 无 AC / BR / NF / Then 判据行改动；无附录 A、附录 B、其它 D 节（D-1~D-10、D-12~D-14）改动。
- v6 新增段落中的「AC 51 / BR 43 / NF 7 与全部 Then 零改动」为**版本记录叙述文字**，非判据正文，不构成判据改动。

→ 判据 1 **PASS**。

### 判据 2 · AC 51 / BR 43 / NF 7 计数与编号连续；Then 集合不变 —— PASS

命令（工作区文件记为 `$F`）：
```bash
for t in AC BR NF; do
  git show c0e46aa:$F | grep -oE "${t}-[0-9]+" | sort -u | wc -l   # HEAD
  grep -oE "${t}-[0-9]+" $F | sort -u | wc -l                       # WT
done
```
输出：
```
AC: HEAD=51 WT=51
BR: HEAD=43 WT=43
NF: HEAD=7  WT=7
```
编号连续性：
```
AC expect 1..51, max=51, missing=[]
BR expect 1..43, max=43, missing=[]
NF expect 1..7,  max=7,  missing=[]
```

Then 判据行（形态 `^- \*\*Then\*\*`）严格比对：
```bash
git show c0e46aa:$F | grep -cE '^- \*\*Then\*\*'   # 51
grep -cE '^- \*\*Then\*\*' $F                       # 51
comm -3 <(git show c0e46aa:$F | grep -E '^- \*\*Then\*\*' | sort) \
        <(grep -E '^- \*\*Then\*\*' $F | sort)       # 输出为空
```
输出：`HEAD 51 / WT 51`，`comm -3` 差异为空 → **Then 判据行集合与 HEAD 完全相同**。

> 说明：若用宽松 `grep 'Then'`，WT 比 HEAD 多 1 行（96 → 97），该行正是第 1473 行 v6 记录里「**全部 Then 零改动**」措辞，不是 `**Then**` 判据行（严格形态比对已排除）。不构成 Then 判据变化。

→ 判据 2 **PASS**。

### 判据 3 · 版本一致性与 v6 行声明 —— PASS

- 头部第 7 行：`- **版本**：v6`
- 附录 C（`## 附录 C · 变更记录`，第 1387–1475 行）末行第 1473 行以 `- v6（2026-11-16）` 开头 → 与头部 v6 一致。
- v6 行关键词实测（`sed -n '1473p' | grep -oE ...`）：
```
只扩附录 D-11 授权断言修改清单
零改动
未改任何判定强度
```
  即 v6 行明确写明「只扩授权、不改判据」（原文：`只扩附录 D-11 授权断言修改清单`、`AC 51 / BR 43 / NF 7 与全部 Then 零改动，未删任何内容、未改任何判定强度`）。

→ 判据 3 **PASS**。

### 判据 4 · D-11 新增授权：点名文件+行号+只改哪一段；N=63 自洽；断言不放宽 —— PASS

新增授权位于 D-11（第 1605–1612 行），点名与行号：

| 文件 | 行号 | 只改哪一段 | 注释覆盖 |
|---|---|---|---|
| `errors.test.js` | 965 | 键总数断言 `147` → `147 + N`（N=63） | 16 行注释「147 键」同一口径 |
| `http-channel.test.js` | 131、142 | 131 标题 `frozen 147-key payload` → `147 + N` key；142 键总数断言 `147` → `147 + N` | 10 行注释 `frozen 147-key contract` 同一口径 |

N=63 自洽实测：
```bash
node -e "const l=require('./src/daemon/http/labels.js');
 console.log('UI_LABEL_KEYS',Object.keys(l.UI_LABEL_KEYS).length);
 console.log('DRILL_*',Object.keys(l.DESKTOP_LABEL_KEYS).filter(x=>x.startsWith('DRILL_')).length);"
```
输出：`UI_LABEL_KEYS = 210`、`DRILL_* = 63`。
- `GET /ui/labels` 下发载体为 `UI_LABEL_KEYS` = **210 键**；冻结基线 **147**；`210 - 147 = 63`，与 `DRILL_* = 63` 及文档 **N=63** 三者自洽。

断言形态不放宽实测（测试工作区现状，只读核对）：
```
errors.test.js:965        assert.equal(Object.keys(payload.keys).length, 147 + 63);   // 精确值 210
http-channel.test.js:142  assert.equal(Object.keys(payload.keys).length, 147 + 63);   // 精确值 210
http-channel.test.js:131  test('GET /ui/labels serves the frozen 147 + 63 key payload ...')
errors.test.js:16         147 + 63 键
http-channel.test.js:10   frozen 147 + 63 key contract
```
- 断言仍为 `assert.equal(..., 147 + 63)` 精确相等断言（精确值 210），未删断言、未放宽为 `notEqual` / 区间比较；`147 + N` 为精确值。
- 文档 D-11 明文约束「断言形态不变，不许删断言或放宽为不等于比较」，与实测一致。

> 记录（不构成阻断）：
> ① v6 记录行把承载 147→210 的键集写作 `DESKTOP_LABEL_KEYS`，而实测该导出为 127 键、真正下发 210 键的是 `UI_LABEL_KEYS`；此为版本记录的措辞口径，判据 4 要求的「N=63 与 210-147 自洽」按实测载体完全成立，按「只判这几条、不因文风加阻断」不设为阻断。
> ② 判据所述 `strictEqual` 按「精确相等、不放宽」意旨核对：实测为 `assert.equal` 配精确数值 147+63（number 比较行为与 strictEqual 一致），形态未被放宽，满足判据意旨。

→ 判据 4 **PASS**。

### 判据 5 · D-11 原有三处授权未被删改 —— PASS

`git diff c0e46aa -- ...` 中第 1601–1604 行（`labels-desktop.test.js` 三处）以**上下文行**出现（无 `+`/`-`），未删未改：

| 处 | 行号 | 内容 |
|---|---|---|
| 1 | 63 | `EXPECTED_DESKTOP_KEYS` 键全集，只追加 `DRILL_*` |
| 2 | 131 | `EXPECTED_DESKTOP_VALUES` 逐字值断言，只追加 |
| 3 | 310 | 键总数断言 `147` → `147 + 本迭代新增键数` |

新增授权通过第 1612 行「范围澄清（只扩不减，原文保留）」明确旧措辞「唯一授权修改的既有测试文件」「（除上面一个）」仅指 v5 范围，不删原文、不否定新增两处。

→ 判据 5 **PASS**。

---

## §2 diff 摘要

```
docs/iterations/iteration-10b/requirement.md | 11 ++++++++++-
1 file changed, 10 insertions(+), 1 deletion(-)
```
- 3 个 hunk：头部版本行（1+/1-）、附录 C v6 记录行（1+）、D-11 新增两处授权及理由/范围澄清（8+）。
- 变更性质：仅版本号、版本记录文字、D-11 授权清单扩充；无判定强度变化。

---

## §3 结论

五条判据全绿，无阻断项。**总判 PASS**，**准 S2 继续**。
- 判据 1/2/3/5 直接成立；
- 判据 4 的 N=63 与实测 `210-147` 自洽、断言形态未被放宽，成立；
- 两处记录性观察（键集名称措辞、assert.equal/strictEqual 术语）属文风/口径，按硬约束不设阻断。
