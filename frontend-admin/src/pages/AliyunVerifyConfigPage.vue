<template>
  <GlassCard title="阿里云手机号三要素认证" icon="🛡️" subtitle="手机号三要素详细版（姓名 + 身份证 + 手机号）">
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 24px">
      <template #title>接入说明</template>
      需先在阿里云市场购买「手机号三要素详细版」服务，将获得的 AppKey 配置到下方表单。
      凭据使用 AES-256-CBC 加密存储，运行时解密。
    </el-alert>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="160px">
      <el-form-item label="AccessKey ID" prop="accessKey">
        <el-input v-model="form.accessKey" show-password />
      </el-form-item>
      <el-form-item label="AccessKey Secret" prop="secretKey">
        <el-input v-model="form.secretKey" show-password />
      </el-form-item>
      <el-form-item label="产品 CODE" prop="productCode">
        <el-input v-model="form.productCode" placeholder="阿里云市场产品 CODE" />
        <div class="form-tip">在阿里云市场订单详情页面获取</div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
        <el-button @click="loadData">取消</el-button>
      </el-form-item>
    </el-form>
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const formRef = ref<FormInstance>();
const saving = ref(false);

const form = reactive({
  accessKey: '',
  secretKey: '',
  productCode: '',
});

const rules = {
  accessKey: [{ required: true, message: '请输入 AccessKey', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 Secret', trigger: 'blur' }],
  productCode: [{ required: true, message: '请输入产品 CODE', trigger: 'blur' }],
};

async function loadData(): Promise<void> {
  try {
    const res = await http.get('/admin/config/aliyun-verify');
    if (res) form.productCode = res.productCode || '';
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
      await http.put('/admin/config/aliyun-verify', form);
      ElMessage.success('配置已加密保存');
      loadData();
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

onMounted(loadData);
</script>

<style scoped>
.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
