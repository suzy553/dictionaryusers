# 让这张图动起来 —— 提示词与参数

适用于：即梦「图生视频」、可灵、Runway、Pika、海螺、豆包视频等。

---

## 一、短版提示词（先试这个）

```
镜头基本不动。木木枭在石墙上来回轻跳，女孩缓慢翻动书页，
草叶和树叶随风轻摆，云朵缓慢横向漂移。动作轻微、自然、循环。
保持原图画风、配色和构图不变，不改变人物长相。
```

---

## 二、完整版提示词（推荐）

```
以这张图为第一帧，生成 5 秒循环动画，保持日系动画风格、原配色和构图不变。

【主体动作】
女孩坐在石墙上看书，每隔约 1.5 秒轻轻翻动一次书页，翻页有轻微的纸张弹性；
她的头发和裙角随微风小幅摆动；呼吸起伏轻微可见，肩膀缓慢上下。

【木木枭】
小猫头鹰在石墙上左右轻跳：先向右小跳一步，停顿，再跳回原位，
循环往复。跳动时身体有轻微挤压拉伸（squash & stretch），
头顶两片叶子跟着晃动。眼睛每 2 秒眨一次。

【环境动作】
前景草丛和野草顺着同一方向（从左往右）波浪式摆动，越靠近镜头摆幅越大；
背景树叶轻轻摇晃，有细碎的光斑在墙面和草地上闪烁；
天空的积云非常缓慢地向右漂移，几乎察觉不到。

【镜头】
完全固定机位，不做推拉摇移。景深保持原样。

【节奏】
所有动作都是缓慢、轻微、不打扰的，像夏日午后的微风，适合长时间循环播放。
```

---

## 三、英文版（Runway / Pika / Kling 国际版）

```
Animate this exact image as the first frame, 5-second seamless loop.
Keep the anime style, colors and composition identical.

The girl sits on the stone wall reading; every ~1.5s she gently turns a page
with a slight paper bounce. Her hair and skirt sway in a light breeze,
shoulders rise and fall subtly with breathing.

The small owl on the wall hops left and right in place: one small hop to the
right, pause, hop back, repeat. Squash-and-stretch on each hop, the two leaves
on its head bob. It blinks every 2 seconds.

Foreground grass waves in a smooth traveling ripple from left to right,
larger amplitude near the camera. Background foliage sways gently,
dappled light flickers on the wall and grass. Clouds drift very slowly to the right.

Camera: completely static, no pan / zoom / dolly. Keep the depth of field.
Mood: slow, gentle, summer afternoon breeze, made to loop for a long time.
```

---

## 四、参数怎么设

| 参数 | 建议值 | 原因 |
|---|---|---|
| 时长 | 4–6 秒 | 再长人物容易崩，循环够用 |
| 运动幅度 / Motion | **低～中（2～4 成）** | 调高人物会扭曲变形 |
| 镜头运动 / Camera | **静止（Static）** | 一动就露馅，且和 UI 冲突 |
| 参考强度 / Image weight | **高（0.85 以上）** | 保证第一帧就是原图 |
| 分辨率 | 720p 起 | 1080p 更好，但文件大 |
| 固定种子 / Seed | 记下满意的种子 | 方便微调 |

---

## 五、一次生成 3 个动作容易崩，建议分两段做

AI 视频最怕"同时动太多"。如果一次出不来，拆开做：

**第一段（只让环境动）**
```
镜头固定。草叶和树叶随风轻摆，云朵缓慢漂移，光斑闪烁。
人物和木木枭保持完全静止。动作轻微，循环。
```
→ 这段最容易成功，出来就已经很生动了。

**第二段（只让鸟动）**
```
镜头固定。只有木木枭在石墙上左右轻跳，其他一切保持静止。
跳动轻微，身体有挤压拉伸，头顶叶子晃动。
```

**第三段（只让人物动）**
```
镜头固定。女孩缓慢翻动书页，头发轻微飘动，其他保持静止。
```

三段都成功的话，再尝试合成一段完整的；不行就用第一段 + 后期剪在一起。

---

## 六、负面提示词（一定要加）

```
变形, 人物扭曲, 脸部崩坏, 五官漂移, 多余的手指, 肢体扭曲,
镜头快速移动, 画面闪烁, 风格突变, 变成写实, 尺寸抖动, 水印, 文字
```

---

## 七、常见的崩坏和对策

| 现象 | 原因 | 对策 |
|---|---|---|
| 人物脸变形 | 运动幅度太大 | 把 Motion 调到 2 成，只做局部动作 |
| 人物整个飘起来 | 模型把整体当刚体位移 | 加"人物位置固定不动，只有手臂和头发动" |
| 书页糊成一团 | 翻页幅度过大 | 改成"手指轻抚书页边缘，纸张轻微起伏"，不要真的翻过去 |
| 云像贴纸平移 | 速度太快 | 加"极缓慢，几乎静止" |
| 循环接不上 | 首尾帧差异大 | 选"循环/loop"模式，或用 4 秒而不是 10 秒 |
| 越到后面越糊 | 累积误差 | 缩短时长，只取前 4 秒 |

---

## 八、拿到视频之后

1. 导出 **mp4（H.264）**，静音
2. 控制在 **720p、5 秒、3MB 以内**
3. 命名为 `bg-loop.mp4`，放到：

```
ielts-bookshelf/data/bg-loop.mp4
```

**App 已经支持了**：放进去自动全屏循环播放、静音自动开始，UI 毛玻璃不变；
没有视频就自动回退到静态图 + 缓慢推拉效果。

如果再出一张夜景图，命名 `bg-night.jpg` 放进同一个目录，夜晚主题会自动切换。
