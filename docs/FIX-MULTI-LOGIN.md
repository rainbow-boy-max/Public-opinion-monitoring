# 多方式登录支持整改方案

## 需求

用户端登录页支持三种登录方式，用户可自由切换：

| 方式 | 输入 | 说明 |
|------|------|------|
| 账号密码 | 用户名 + 密码 | 现有方式 |
| 手机密码 | 手机号 + 密码 | 新增 |
| 手机验证码 | 手机号 + 短信验证码 | 新增 |

## 后端改动

### 1. 修改 `LoginDto`（`auth.controller.ts`）

```typescript
class LoginDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  code?: string;  // 短信验证码
}
```

### 2. 修改 `login()` 方法（`auth.service.ts`）

登录逻辑改为三种分支：

```
login(dto):
  if dto.username → 按用户名查找用户 + 密码验证 (现有逻辑)
  if dto.phone && dto.password → 按手机号查找用户 + 密码验证
  if dto.phone && dto.code → 按手机号查找用户 + 验证码验证（复用 register 中的验证码校验）
```

### 3. 验证码校验逻辑复用

`send-sms-code` 端点已存在，但当前 `scene` 参数支持 `login`/`register`/`reset`。登录场景的验证码发送已支持，只需要在 `login()` 中增加验证码校验逻辑：

```typescript
// 验证码校验
const cached = await this.redisService.get(`sms:${dto.phone}:login`);
if (!cached || cached !== dto.code) {
  throwBusiness('AUTH_INVALID_CODE', { phone: dto.phone });
}
```

## 前端改动

### 登录页重设计（`LoginPage.vue`）

```html
<el-tabs v-model="loginMode" class="login-tabs">
  <el-tab-pane label="账号密码" name="account">
    <el-input v-model="form.username" placeholder="用户名" />
    <el-input v-model="form.password" type="password" placeholder="密码" />
  </el-tab-pane>
  
  <el-tab-pane label="手机密码" name="phone-pwd">
    <el-input v-model="form.phone" placeholder="手机号" maxlength="11" />
    <el-input v-model="form.password" type="password" placeholder="密码" />
  </el-tab-pane>
  
  <el-tab-pane label="手机验证码" name="phone-code">
    <el-input v-model="form.phone" placeholder="手机号" maxlength="11" />
    <div class="code-row">
      <el-input v-model="form.code" placeholder="验证码" maxlength="6" />
      <el-button :disabled="smsCountdown > 0" @click="sendLoginCode">
        {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
      </el-button>
    </div>
  </el-tab-pane>
</el-tabs>
```

### `onLogin()` 方法

根据 `loginMode` 调用后端 API：

```typescript
async function onLogin() {
  const payload: any = {};
  if (loginMode.value === 'account') {
    payload.username = form.username;
    payload.password = form.password;
  } else if (loginMode.value === 'phone-pwd') {
    payload.phone = form.phone;
    payload.password = form.password;
  } else {
    payload.phone = form.phone;
    payload.code = form.code;
  }
  await auth.login(payload);
  // ... 后续跳转不变
}
```

### 修改 `auth store`（`store/auth.ts`）

当前 `login()` 方法接受 `(username, password)`，需改为接受对象 `(payload)`：

```typescript
async function login(payload: { username?: string; phone?: string; password?: string; code?: string }): Promise<void> {
  const data = await http.post('/auth/login', payload);
  // ... 现有逻辑
}
```

## 改动清单

| 文件 | 改动 |
|------|------|
| `backend/.../auth.controller.ts` | 扩展 `LoginDto`，添加可选字段 |
| `backend/.../auth.service.ts` | `login()` 支持三种认证方式 |
| `frontend-user/.../LoginPage.vue` | 重写登录表单（三 tab） |
| `frontend-user/.../store/auth.ts` | 修改 `login()` 参数为对象 |

---

确认后实施。
