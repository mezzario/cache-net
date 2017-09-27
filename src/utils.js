import stringify from "json-stable-stringify"
import md5 from "blueimp-md5"

export function getKeyStruct(key) {
  if (key == null)
    throw new Error("'key' cannot be null or undefined")

  if (typeof key == "function" || typeof key == "symbol")
    throw new Error(`Usupported key type: '${typeof key}'`)

  const keyStruct = {
    key,
    keyStr: typeof key === "object" ? md5(stringify(key)) : String(key),
    keyData: typeof key === "object" ? key : null,
  }

  return keyStruct
}
