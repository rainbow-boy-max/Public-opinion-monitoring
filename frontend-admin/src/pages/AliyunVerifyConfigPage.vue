<template>
  <div class="config-page">
    <GlassCard title="阿里云手机号三要素认证" icon="🛡️" subtitle="Mobile3MetaDetailVerify · 详细版">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 24px">
        <template #title>接入说明</template>
        <p style="margin-bottom: 8px">
          需先在阿里云市场购买「手机号三要素详细版」服务，获取 AppKey 与 ProductCode 后填入下方。
        </p>
        <p style="margin-bottom: 4px">凭据使用 AES-256-CBC 加密存储。</p>
        <p>配置完成后点击右上角"测试连接"验证 AK/SK 是否正确。</p>
      </el-alert>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
        <el-form-item label="AccessKey ID" prop="accessKey">
          <el-input v-model="form.accessKey" show-password placeholder="阿里云 AccessKey ID" />
        </el-form-item>
        <el-form-item label="AccessKey Secret" prop="secretKey">
          <el-input v-model="form.secretKey" show-password placeholder="阿里云 AccessKey Secret" />
        </el-form-item>
        <el-form-item label="Product CODE" prop="productCode">
          <el-input v-model="form.productCode" placeholder="阿里云市场产品 CODE" />
          <div class="form-tip">阿里云市场订单详情页获取，形如 cmapi00072260</div>
        </el-form-item>
        <el-form-item label="Endpoint 类型" prop="endpointType">
          <el-radio-group v-model="form.endpointType">
            <el-radio-button value="common">通用 (推荐)</el-radio-button>
            <el-radio-button value="beijing">北京</el-radio-button>
            <el-radio-button value="shanghai">上海</el-radio-button>
          </el-radio-group>
          <div class="form-tip">选择离你服务器最近的地域，网络延迟最低</div>
        </el-form-item>
        <el-form-item label="参数加密方式" prop="paramType">
          <el-radio-group v-model="form.paramType">
            <el-radio-button value="md5">MD5 (推荐)</el-radio-button>
            <el-radio-button value="normal">明文 (normal)</el-radio-button>
            <el-radio-button value="sm2">国密 SM2</el-radio-button>
          </el-radio-group>
          <div class="form-tip">MD5 加密：服务端已自动将姓名/身份证/手机号做 MD5 32 位小写</div>
        </el-form-item>
        <el-form-item label="地域 Region">
          <el-input v-model="form.region" placeholder="留空使用默认 cn-hangzhou" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
          <el-button type="success" :loading="testing" @click="onTest">测试连接</el-button>
          <el-button @click="loadData">取消</el-button>
        </el-form-item>
      </el-form>
    </GlassCard>

    <GlassCard title="API 接入文档" icon="📖" subtitle="阿里云手机号三要素详细版 - Mobile3MetaDetailVerify">
      <div class="api-doc">
        <el-collapse>
          <el-collapse-item title="请求参数" name="params">
            <el-table :data="requestParams" stripe>
              <el-table-column prop="name" label="参数" width="180" />
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column prop="required" label="必填" width="80" />
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </el-collapse-item>
          <el-collapse-item title="响应参数 (BizCode/SubCode)" name="response">
            <el-table :data="responseParams" stripe>
              <el-table-column prop="biz" label="BizCode" width="100" />
              <el-table-column prop="sub" label="SubCode" width="100" />
              <el-table-column prop="meaning" label="含义" />
            </el-table>
          </el-collapse-item>
          <el-collapse-item title="支持的 endpoint" name="endpoints">
            <ul class="endpoints-list">
              <li><code>cloudauth.aliyuncs.com</code> - 通用（推荐）</li>
              <li><code>cloudauth.cn-beijing.aliyuncs.com</code> - 北京</li>
              <li><code>cloudauth.cn-shanghai.aliyuncs.com</code> - 上海</li>
              <li>系统自动顺序 failover，确保可用性</li>
            </ul>
          </el-collapse-item>
          <el-collapse-item title="QPS 限额" name="qps">
            <p>专属 QPS 配额，需在阿里云控制台申请。建议预充值流量包。</p>
          </el-collapse-item>
        </el-collapse>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AliyunVerifyConfigPage' });
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const formRef = ref<FormInstance>();
const saving = ref(false);
const testing = ref(false);

const form = reactive({
  accessKey: '',
  secretKey: '',
  productCode: '',
  endpointType: 'common',
  paramType: 'md5',
  region: '',
});

const rules = {
  accessKey: [{ required: true, message: '请输入 AccessKey', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 Secret', trigger: 'blur' }],
  productCode: [{ required: true, message: '请输入产品 CODE', trigger: 'blur' }],
  endpointType: [{ required: true, message: '请选择 Endpoint 类型', trigger: 'change' }],
  paramType: [{ required: true, message: '请选择参数加密方式', trigger: 'change' }],
};

const requestParams = [
  { name: 'ParamType', type: 'String', required: '是', desc: '加密方式：md5 / normal / sm2' },
  { name: 'IdentifyNum', type: 'String', required: '是', desc: '身份证号 (md5 传 32 位小写密文)' },
  { name: 'UserName', type: 'String', required: '是', desc: '姓名 (md5 加密)' },
  { name: 'Mobile', type: 'String', required: '是', desc: '手机号 (md5 加密)' },
];

const responseParams = [
  { biz: '1', sub: '101', meaning: '认证一致 (✓ 通过)' },
  { biz: '2', sub: '201', meaning: '姓名/身份证/手机号 三要素均不一致' },
  { biz: '2', sub: '202', meaning: '姓名与手机号一致，但身份证不一致' },
  { biz: '2', sub: '203', meaning: '姓名不一致，但手机号与身份证一致' },
  { biz: '2', sub: '204', meaning: '其他不一致情况' },
  { biz: '3', sub: '301', meaning: '查无记录' },
];

async function loadData(): Promise<void> {
  try {
    const res = await http.get('/admin/config/aliyun-verify');
    if (res) {
      form.productCode = res.productCode || '';
      form.endpointType = res.endpointType || 'common';
      form.paramType = res.paramType || 'md5';
      form.region = res.region || '';
    }
  } catch (err) {
    console.error(err);
  }
}

async function onSave(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      await http.put('/admin/config/aliyun-verify', { ...form });
      ElMessage.success('配置已加密保存');
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

async function onTest(): Promise<void> {
  await onSave();
  testing.value = true;
  try {
    const res = await http.post('/admin/aliyun-verify/test');
    if (res?.ok) {
      ElMessage.success(`连接成功 (${res.endpointUsed}, ${res.latencyMs}ms)`);
    } else {
      ElMessage.error(`连接失败: ${res?.message}`);
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '测试失败');
  } finally {
    testing.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.api-doc :deep(.el-collapse-item__header) {
  color: var(--text-primary);
  font-weight: 500;
  background: rgba(15, 19, 47, 0.4) !important;
  border-bottom: 1px solid var(--border-subtle);
}

.endpoints-list {
  margin: 0;
  padding: 0 0 0 16px;
  list-style: none;
  color: var(--text-secondary);
}

.endpoints-list li {
  padding: 6px 0;
}

.endpoints-list code {
  background: rgba(94, 114, 228, 0.15);
  color: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  margin-right: 12px;
}
</style>
