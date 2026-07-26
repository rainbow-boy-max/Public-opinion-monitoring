<template>
  <div class="short-video-config">
    <el-card>
      <template #header>
        <span>短视频平台配置</span>
      </template>

      <el-tabs v-model="activeTab">
        <!-- 平台配置 Tab -->
        <el-tab-pane label="平台配置" name="platforms">
          <el-collapse v-model="activePlatforms">
            <!-- 抖音 -->
            <el-collapse-item name="douyin">
              <template #title>
                <div class="platform-header">
                  <span>抖音开放平台</span>
                  <el-tag :type="getPlatformStatus('douyin') ? 'success' : 'info'" size="small">
                    {{ getPlatformStatus('douyin') ? '已启用' : '未启用' }}
                  </el-tag>
                </div>
              </template>
              <el-form :model="platforms.douyin" label-width="140px">
                <el-form-item label="App Key">
                  <el-input v-model="platforms.douyin.appKey" placeholder="请输入抖音 App Key" />
                </el-form-item>
                <el-form-item label="App Secret">
                  <el-input
                    v-model="platforms.douyin.appSecret"
                    type="password"
                    placeholder="请输入抖音 App Secret"
                    show-password
                  />
                </el-form-item>
                <el-form-item label="API Base URL">
                  <el-input
                    v-model="platforms.douyin.apiBaseUrl"
                    placeholder="https://open.douyin.com"
                  />
                </el-form-item>
                <el-form-item label="启用状态">
                  <el-switch v-model="platforms.douyin.isEnabled" />
                </el-form-item>
                <el-form-item label="备注">
                  <el-input
                    v-model="platforms.douyin.remark"
                    type="textarea"
                    :rows="2"
                    placeholder="可选"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="savePlatformConfig('douyin')" :loading="loading">
                    保存配置
                  </el-button>
                  <el-button @click="testConnection('douyin')" :loading="testing">
                    测试连接
                  </el-button>
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- 快手 -->
            <el-collapse-item name="kuaishou">
              <template #title>
                <div class="platform-header">
                  <span>快手开放平台</span>
                  <el-tag :type="getPlatformStatus('kuaishou') ? 'success' : 'info'" size="small">
                    {{ getPlatformStatus('kuaishou') ? '已启用' : '未启用' }}
                  </el-tag>
                </div>
              </template>
              <el-form :model="platforms.kuaishou" label-width="140px">
                <el-form-item label="App Key">
                  <el-input v-model="platforms.kuaishou.appKey" placeholder="请输入快手 App Key" />
                </el-form-item>
                <el-form-item label="App Secret">
                  <el-input
                    v-model="platforms.kuaishou.appSecret"
                    type="password"
                    placeholder="请输入快手 App Secret"
                    show-password
                  />
                </el-form-item>
                <el-form-item label="API Base URL">
                  <el-input
                    v-model="platforms.kuaishou.apiBaseUrl"
                    placeholder="https://open.kuaishou.com"
                  />
                </el-form-item>
                <el-form-item label="启用状态">
                  <el-switch v-model="platforms.kuaishou.isEnabled" />
                </el-form-item>
                <el-form-item label="备注">
                  <el-input
                    v-model="platforms.kuaishou.remark"
                    type="textarea"
                    :rows="2"
                    placeholder="可选"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="savePlatformConfig('kuaishou')" :loading="loading">
                    保存配置
                  </el-button>
                  <el-button @click="testConnection('kuaishou')" :loading="testing">
                    测试连接
                  </el-button>
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- 微信视频号 -->
            <el-collapse-item name="weixin_channels">
              <template #title>
                <div class="platform-header">
                  <span>微信视频号</span>
                  <el-tag :type="getPlatformStatus('weixin_channels') ? 'success' : 'info'" size="small">
                    {{ getPlatformStatus('weixin_channels') ? '已启用' : '未启用' }}
                  </el-tag>
                </div>
              </template>
              <el-form :model="platforms.weixin_channels" label-width="140px">
                <el-form-item label="App Key">
                  <el-input v-model="platforms.weixin_channels.appKey" placeholder="请输入微信 App Key" />
                </el-form-item>
                <el-form-item label="App Secret">
                  <el-input
                    v-model="platforms.weixin_channels.appSecret"
                    type="password"
                    placeholder="请输入微信 App Secret"
                    show-password
                  />
                </el-form-item>
                <el-form-item label="API Base URL">
                  <el-input
                    v-model="platforms.weixin_channels.apiBaseUrl"
                    placeholder="https://api.weixin.qq.com"
                  />
                </el-form-item>
                <el-form-item label="启用状态">
                  <el-switch v-model="platforms.weixin_channels.isEnabled" />
                </el-form-item>
                <el-form-item label="备注">
                  <el-input
                    v-model="platforms.weixin_channels.remark"
                    type="textarea"
                    :rows="2"
                    placeholder="可选"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="savePlatformConfig('weixin_channels')" :loading="loading">
                    保存配置
                  </el-button>
                  <el-button @click="testConnection('weixin_channels')" :loading="testing">
                    测试连接
                  </el-button>
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- B站 -->
            <el-collapse-item name="bilibili">
              <template #title>
                <div class="platform-header">
                  <span>哔哩哔哩</span>
                  <el-tag :type="getPlatformStatus('bilibili') ? 'success' : 'info'" size="small">
                    {{ getPlatformStatus('bilibili') ? '已启用' : '未启用' }}
                  </el-tag>
                </div>
              </template>
              <el-form :model="platforms.bilibili" label-width="140px">
                <el-form-item label="App Key">
                  <el-input v-model="platforms.bilibili.appKey" placeholder="请输入 B 站 App Key" />
                </el-form-item>
                <el-form-item label="App Secret">
                  <el-input
                    v-model="platforms.bilibili.appSecret"
                    type="password"
                    placeholder="请输入 B 站 App Secret"
                    show-password
                  />
                </el-form-item>
                <el-form-item label="API Base URL">
                  <el-input
                    v-model="platforms.bilibili.apiBaseUrl"
                    placeholder="https://api.bilibili.com"
                  />
                </el-form-item>
                <el-form-item label="启用状态">
                  <el-switch v-model="platforms.bilibili.isEnabled" />
                </el-form-item>
                <el-form-item label="备注">
                  <el-input
                    v-model="platforms.bilibili.remark"
                    type="textarea"
                    :rows="2"
                    placeholder="可选"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="savePlatformConfig('bilibili')" :loading="loading">
                    保存配置
                  </el-button>
                  <el-button @click="testConnection('bilibili')" :loading="testing">
                    测试连接
                  </el-button>
                </el-form-item>
              </el-form>
            </el-collapse-item>
          </el-collapse>
        </el-tab-pane>

        <!-- 阿里云配置 Tab -->
        <el-tab-pane label="阿里云配置" name="aliyun">
          <el-form :model="aliyunConfig" label-width="180px" style="max-width: 800px">
            <el-divider content-position="left">基础配置</el-divider>
            <el-form-item label="Access Key ID">
              <el-input v-model="aliyunConfig.accessKeyId" placeholder="请输入阿里云 Access Key ID" />
            </el-form-item>
            <el-form-item label="Access Key Secret">
              <el-input
                v-model="aliyunConfig.accessKeySecret"
                type="password"
                placeholder="请输入阿里云 Access Key Secret"
                show-password
              />
            </el-form-item>
            <el-form-item label="Region ID">
              <el-select v-model="aliyunConfig.regionId" placeholder="请选择区域">
                <el-option label="华东1（杭州）" value="cn-hangzhou" />
                <el-option label="华北2（北京）" value="cn-beijing" />
                <el-option label="华东2（上海）" value="cn-shanghai" />
                <el-option label="华南1（深圳）" value="cn-shenzhen" />
              </el-select>
            </el-form-item>

            <el-divider content-position="left">OSS 存储配置</el-divider>
            <el-form-item label="OSS Bucket">
              <el-input v-model="aliyunConfig.ossBucket" placeholder="your-bucket-name" />
            </el-form-item>
            <el-form-item label="OSS Endpoint">
              <el-input v-model="aliyunConfig.ossEndpoint" placeholder="oss-cn-hangzhou.aliyuncs.com" />
            </el-form-item>

            <el-divider content-position="left">视频 OCR 配置</el-divider>
            <el-form-item label="视频内容理解 Endpoint">
              <el-input v-model="aliyunConfig.vcaEndpoint" placeholder="vca.cn-hangzhou.aliyuncs.com" />
            </el-form-item>

            <el-divider content-position="left">语音识别配置</el-divider>
            <el-form-item label="语音识别 App Key">
              <el-input v-model="aliyunConfig.asrAppKey" placeholder="请输入语音识别 App Key" />
            </el-form-item>
            <el-form-item label="语音识别 Endpoint">
              <el-input v-model="aliyunConfig.asrEndpoint" placeholder="nls-gateway-cn-shanghai.aliyuncs.com" />
            </el-form-item>

            <el-divider />
            <el-form-item label="启用状态">
              <el-switch v-model="aliyunConfig.isEnabled" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input
                v-model="aliyunConfig.remark"
                type="textarea"
                :rows="3"
                placeholder="可选"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveAliyunConfig" :loading="loading">
                保存配置
              </el-button>
              <el-button @click="testAliyunConnection" :loading="testing">
                测试连接
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const activeTab = ref('platforms')
const activePlatforms = ref(['douyin'])
const loading = ref(false)
const testing = ref(false)

const platforms = ref<any>({
  douyin: { platform: 'douyin', isEnabled: false, appKey: '', appSecret: '', apiBaseUrl: 'https://open.douyin.com' },
  kuaishou: { platform: 'kuaishou', isEnabled: false, appKey: '', appSecret: '', apiBaseUrl: 'https://open.kuaishou.com' },
  weixin_channels: { platform: 'weixin_channels', isEnabled: false, appKey: '', appSecret: '', apiBaseUrl: 'https://api.weixin.qq.com' },
  bilibili: { platform: 'bilibili', isEnabled: false, appKey: '', appSecret: '', apiBaseUrl: 'https://api.bilibili.com' }
})

const aliyunConfig = ref({
  accessKeyId: '',
  accessKeySecret: '',
  regionId: 'cn-hangzhou',
  ossBucket: '',
  ossEndpoint: 'oss-cn-hangzhou.aliyuncs.com',
  vcaEndpoint: 'vca.cn-hangzhou.aliyuncs.com',
  asrAppKey: '',
  asrEndpoint: 'nls-gateway-cn-shanghai.aliyuncs.com',
  isEnabled: false,
  remark: ''
})

const getPlatformStatus = (platform: string) => {
  return platforms.value[platform]?.isEnabled || false
}

const fetchPlatformConfigs = async () => {
  try {
    const res = await request.get('/admin/short-video-config/platforms')
    if (res.data && res.data.length > 0) {
      res.data.forEach((config: any) => {
        if (platforms.value[config.platform]) {
          platforms.value[config.platform] = { ...platforms.value[config.platform], ...config }
        }
      })
    }
  } catch (error: any) {
    console.error('获取平台配置失败:', error)
  }
}

const fetchAliyunConfig = async () => {
  try {
    const res = await request.get('/admin/short-video-config/aliyun')
    if (res.data) {
      aliyunConfig.value = { ...aliyunConfig.value, ...res.data }
    }
  } catch (error: any) {
    console.log('阿里云配置未设置')
  }
}

const savePlatformConfig = async (platform: string) => {
  try {
    loading.value = true
    await request.put(`/admin/short-video-config/platforms/${platform}`, platforms.value[platform])
    ElMessage.success('平台配置已保存')
    await fetchPlatformConfigs()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    loading.value = false
  }
}

const testConnection = async (platform: string) => {
  try {
    testing.value = true
    const res = await request.post(`/admin/short-video-config/platforms/${platform}/test`)
    if (res.success) {
      ElMessage.success(res.message)
    } else {
      ElMessage.warning(res.message)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '测试连接失败')
  } finally {
    testing.value = false
  }
}

const saveAliyunConfig = async () => {
  try {
    loading.value = true
    await request.put('/admin/short-video-config/aliyun', aliyunConfig.value)
    ElMessage.success('阿里云配置已保存')
    await fetchAliyunConfig()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    loading.value = false
  }
}

const testAliyunConnection = async () => {
  try {
    testing.value = true
    const res = await request.post('/admin/short-video-config/aliyun/test')
    if (res.success) {
      ElMessage.success(res.message)
    } else {
      ElMessage.warning(res.message)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '测试连接失败')
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  fetchPlatformConfigs()
  fetchAliyunConfig()
})
</script>

<style scoped lang="scss">
.short-video-config {
  padding: 20px;
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 20px;
}
</style>
