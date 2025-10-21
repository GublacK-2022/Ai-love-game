# 数据库设计文档

## 一、characters（角色表）

存储所有AI角色的基础信息
```json
{
  "_id": "char_001",
  "name": "陆景琛",
  "nameEn": "Lucas Lu",
  "age": 28,
  "occupation": "陆氏集团总裁",
  "avatar": "cloud://xxx/characters/luojingchen.png",
  "coverImage": "cloud://xxx/characters/luojingchen-cover.png",

  "tags": ["霸道总裁", "冷面温柔", "占有欲强"],
  "intro": "28岁的陆氏集团总裁，外表高冷，内心温柔",

  "personality": {
    "surface": "高冷寡言，雷厉风行",
    "true": "内心细腻，占有欲强，专一深情"
  },

  "background": "陆氏集团独子，22岁接手家族企业...",

  "systemPrompt": "你是陆景琛，28岁总裁...[完整的AI提示词]",

  // 🎭 新增：开场白系统
  "firstMessages": [
    {
      "scene": "office_meet",
      "title": "办公室初遇",
      "content": "【深夜的陆氏集团大楼...】完整的开场白文本",
      "keywords": ["加班", "关心", "送饭"]
    },
    {
      "scene": "cafe_encounter",
      "title": "咖啡厅偶遇",
      "content": "【周末午后的咖啡厅...】",
      "keywords": ["偶遇", "放松", "约会"]
    },
    {
      "scene": "company_crisis",
      "title": "公司危机",
      "content": "【陆氏集团会议室...】",
      "keywords": ["职场", "挑战", "表现"]
    }
  ],
  "defaultFirstMessage": "office_meet",

  "isFree": true,
  "price": 0,
  "unlockCount": 0,

  "createdAt": "2025-10-18T00:00:00.000Z",
  "updatedAt": "2025-10-18T00:00:00.000Z"
}
```

## 二、users（用户表）
```json
{
  "_id": "user_001",
  "openId": "oXXXX",
  "nickName": "小美",
  "avatarUrl": "https://xxx",
  
  "vipLevel": 0,
  "vipExpireAt": null,
  
  "credits": 100,
  "freeChatCount": 10,
  
  "unlockedCharacters": ["char_001"],
  
  "createdAt": "2025-10-18T00:00:00.000Z",
  "lastLoginAt": "2025-10-18T10:00:00.000Z"
}
```

## 三、chat_sessions（对话会话表）

每个用户和每个角色的对话是一个session
```json
{
  "_id": "session_001",
  "userId": "user_001",
  "characterId": "char_001",
  
  "affection": 15,
  "chatCount": 23,
  
  "lastMessage": "好的，那我先去忙了~",
  "lastChatAt": "2025-10-18T10:30:00.000Z",
  
  "createdAt": "2025-10-18T08:00:00.000Z"
}
```

## 四、chat_history（对话记录表）
```json
{
  "_id": "msg_001",
  "sessionId": "session_001",
  "userId": "user_001",
  "characterId": "char_001",
  
  "role": "user",
  "content": "陆总，今天天气不错~",
  
  "affectionChange": 2,
  
  "createdAt": "2025-10-18T10:25:00.000Z"
}
```

## 五、story_events（剧情事件表）

记录触发的剧情节点
```json
{
  "_id": "event_001",
  "sessionId": "session_001",
  "eventType": "heart_beat",
  "eventName": "心动时刻",
  "triggeredAt": "2025-10-18T10:20:00.000Z"
}
```

## 六、索引设计

### characters表
- _id（升序索引，用于角色列表排序）
- name（唯一索引）
- isFree（普通索引）

### users表
- openId（唯一索引）

### chat_sessions表
- userId + characterId（复合唯一索引）

### chat_history表
- sessionId（普通索引）
- createdAt（降序索引，用于查询最近对话）

---

## 数据库权限设计

### 读权限
- characters：所有用户可读
- users：仅本人可读
- chat_sessions：仅本人可读
- chat_history：仅本人可读

### 写权限
- 所有表：仅通过云函数写入（保证安全）