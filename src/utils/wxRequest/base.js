import wepy from 'wepy'
import Host from '@/utils/host'
import Session from '@/utils/session'

// 登录重试次数
let retryCount = 0

// 登录凭证键值
const loginKey = Session.key.login

// 获取 openid
const getOpenId = async () => {
  if (Session.get(loginKey) !== null) {
    return Session.get(loginKey)
  }

  const wxLogin = await wepy.login();
	const loginResult = await wepy.request({
		url: Host.check_openid,
		method: 'POST',
		header: { 'X-WX-Code': wxLogin.code }
  })
  return loginResult.session
}

const doRequest = async (url, method, params, options = {}) => {
  try {
    let cacheKey = ''
    // 是否可以命中缓存
    if(options.cacheKey) {
      cacheKey = Session.key[options.cacheKey[0]][options.cacheKey[1]]
      const cache = getByCache(cacheKey)
      if (cache) return cache
    }

    const thirdSession = await getOpenId()
    const result = await wepy.request({
      url: url,
      method: method,
      data: params,
      header: { 'Content-Type': 'application/json', 'X-WX-Skey': thirdSession },
    })
    
    // key 过期尝试重连
    if (result.status === 301 && retryCount <= 3) {
      Session.clear(loginKey)
      retryCount += 1
      return doRequest(url, method, params)
    }

    Session.set(loginKey, thirdSession)
    if(cacheKey != '') setByCache(cacheKey, result)
    return result
  } catch (e) {
    wx.showToast({
      title: e.errMsg,
      icon: 'none'
    })
  }
}

const wxUpload = async (url, params = {}) => {
  if (params.file_path == undefined) {
    console.log('无效的文件')
    return false
  }
  const uploadResult = await wepy.uploadFile({
    url: url,
    header: { 'Content-Type': 'application/json', 'X-WX-Skey': await getOpenId() },
    filePath: params.file_path,
    formData: params.query,
    name: 'file'
  })
  return uploadResult
}

// 获取缓存,默认缓存 3600秒
const getByCache = (cacheKey) => {
  const expireTime = 5
  const cacheTime = Date.parse(new Date()) - expireTime
  const cacheValue = Session.get(cacheKey)
  if (cacheValue === null) {
    return false
  } else if (cacheTime < cacheValue.createTime) {
    return false
  }

  return cacheValue.value
}

// 设置缓存
const setByCache = (cacheKey, cacheVal) => {
  if(typeof cacheKey !== 'undefined') {
    Session.set(cacheKey, {
      createTime: Date.parse(new Date()),
      value: cacheVal
    })
  }
}

export default {
  doRequest,
  wxUpload
}



