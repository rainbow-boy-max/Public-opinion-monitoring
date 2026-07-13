<template>
  <el-card>
    <template #header>
      <span>阿里云手机号三要素认证配置</span>
    </template>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 20px">
      配置阿里云手机号三要素详细版 API，用于用户实名认证。
    </el-alert>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
      <el-form-item label="AccessKey ID" prop="accessKey">
        <el-input v-model="form.accessKey" show-password />
      </el-form-item>
      <el-form-item label="AccessKey Secret" prop="secretKey">
        <el-input v-model="form.secretKey" show-password />
      </el-form-item>
      <el-form-item label="产品 CODE" prop="productCode">
        <el-input v-model="form.productCode" placeholder="阿里云三要素产品 CODE" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';

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
      ElMessage.success('配置已保存');
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

onMounted(loadData);
</script>
