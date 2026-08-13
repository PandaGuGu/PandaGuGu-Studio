// Blueprint → AI prompt builders.
// Shared by the browser app (✨生成 / 批量变体 / 复制给网页 AI) and the pgg CLI
// (pgg plan). Keeping one copy guarantees the web app and the CLI speak the
// same prompt contract to the AI.

import type { Blueprint } from './types'

/** 规则说明(映射 + 布局 + 硬性要求),与 JSON 拼成完整用户提示词。 */
const RULES =
  '【映射规则】section→<section>，container/card/nav→<div>，heading→<h1-h6>（用 props.level），text→<p>，link→<a href=props.href>，button→<button>，input→<input placeholder>，image→<img src=props.src>（若 props.src 以 data:image/ 开头，它是一段完整的 base64 图片数据字符串，你**不需要解码或理解它**，只需把它当普通文本、一字不差原样复制进 src 属性，**严禁截断、省略、改写或替换成占位图**；否则 src 是普通 URL/文件名，直接使用）>，raw→原样嵌入 props.html，note→仅作设计意图参考不要渲染。' +
  '【布局规则】layout:"free" 用 position:absolute（x/y/w/h 为 CSS 像素，1 单位=1px@100% zoom，原点在左上角），"row" 用 flex 横向，"column" 用 flex 纵向，"grid"/"wrap" 用 grid/flex-wrap。重叠元素按 zIndex 设 z-index（大者在上）。' +
  '【硬性要求】1) 严格按元素树生成，不得臆造或删除区块；2) 文案一律使用 props 中的 content/label/placeholder，不要自己编内容；3) 图片的 src 若以 data:image/ 开头必须原样完整复制到 <img src>，不得截断或省略；4) 输出完整可运行的单文件 HTML（含 <!DOCTYPE html> 和内联 CSS），不要输出解释文字。'

/**
 * 完整生成提示词(✨ 用画布蓝图生成 / 批量变体 / pgg plan)。
 * @param bp 蓝图对象
 * @param styleDesc 可选风格要求(批量变体用),如「现代 SaaS 风、深色、玻璃拟态」
 */
export function buildBlueprintPrompt(bp: Blueprint, styleDesc?: string): string {
  const style = styleDesc ? `\n\n【风格要求】${styleDesc}` : ''
  return (
    '严格根据以下画布蓝图生成一个完整的 HTML 页面。' +
    RULES +
    style +
    '\n\n```json\n' +
    JSON.stringify(bp, null, 2) +
    '\n```'
  )
}

/**
 * 网页 AI 提示词(复制给 Claude/GPT 等网页版):突出"src 是 base64 字符串、不要解码、原样复制"。
 * 与 buildBlueprintPrompt 的区别:网页 AI 没有内置项目提示词,规则要更啰嗦、更防呆。
 */
export function buildWebAIPrompt(bp: Blueprint): string {
  return (
    '严格根据以下 JSON 布局生成一个完整的 HTML 页面。\n' +
    '【映射规则】section→<section>，container/card/nav→<div>，heading→<h1-h6>，text→<p>，link→<a>，button→<button>，input→<input>，image→<img>，raw→原样嵌入 props.html。\n' +
    '【图片规则】image 元素的 props.src 若以 data:image/ 开头，它是一段完整的 base64 图片数据字符串。你**不需要解码、不需要理解、不需要查看它**，它只是普通文本。你只需把它**一字不差、原样完整复制**到 <img src="..."> 里，浏览器会自动显示图片。**严禁截断、省略、改写、压缩或替换成占位图/链接**。若 src 不是 data: 开头，则按普通 URL 或文件名使用。\n' +
    '【布局规则】layout:"free" 用 position:absolute(x/y/w/h 是像素)；"row"用 flex 横向；"column"用 flex 纵向；"grid"/"wrap"用 grid/flex-wrap。重叠元素按 zIndex 设置 z-index。\n' +
    '【硬性要求】1) 严格按元素树生成，不得臆造或删除区块；2) 文案一律用 props 中的 content/label/placeholder，不要自己编内容；3) 输出完整可运行的单文件 HTML(含 <!DOCTYPE html> 和内联 CSS)，不要输出解释文字。\n\n' +
    '```json\n' +
    JSON.stringify(bp, null, 2) +
    '\n```'
  )
}
