import 'fake-indexeddb/auto'

// jsdom 测试环境里 TextEncoder 返回的 Uint8Array 跟全局的不是同一个（浏览器里没这个问题），
// fflate 用 instanceof 判断，所以这里转一下。
const enc = TextEncoder.prototype.encode
TextEncoder.prototype.encode = function (s?: string) {
  return new Uint8Array(enc.call(this, s))
}
