# 🔄 数据管道 (DATA PIPELINE)

## 一、数据结构规范 (JSON)

所有教材数据最终以 ES Module 导出，位于 `src/data/*.js`。

### 1.1 单个单词对象格式
```javascript
{
  "word": "hello",            // 英文单词/短语
  "phoneticSymbol": "/həˈloʊ/", // 国际音标
  "partSpeech": "int.",        // 词性简写
  "cn": "你好"                 // 中文解释
}
```

### 1.2 教材数组格式
```javascript
export const data = [
  {
    "unit": 1,                // 单元/课时编号 (Number)
    "name": "Hello!",         // 单元标题
    "words": [ ... ]          // 单词对象数组
  },
  ...
];
```

---

## 二、转换自动化脚本

脚本位于 `src/data/generate-data/` 目录，用于处理原始 Excel/CSV 资料。

### 2.1 `convertExcel.js` (核心工具)
- **用途**: 将 `.xlsx` 文件转换为项目可用的 `.js` 数据。
- **核心逻辑**:
  - 跳过含有“章节”字样的表头行。
  - 正则提取章节编号（如 `Unit 1` → `1`）。
  - 清理单元名称中的中文干扰。
  - 自动归类单词到对应的章节。
- **依赖**: 使用 `xlsx` (SheetJS) 库。

### 2.2 `convertExcelUnit.js`
- **差异**: 专门针对以 `Unit` 命名的教材列结构进行优化。

### 2.3 `convertCsv.js`
- **用途**: 处理传统的 CSV 格式数据。
- **兼容性**: 针对可能存在的章节名内逗号进行了分割算法优化。

---

## 三、新教材接入流程

1. **准备原始数据**: 准备包含 `章节, 名称, 单词, 音标, 词性, 中文意思` 六列的 Excel 文件。
2. **放置文件**: 将 `.xlsx` 放入 `src/data/` 目录（或对应的子目录）。
3. **运行转换**:
   ```bash
   node src/data/generate-data/convertExcel.js
   ```
4. **注册教材**: 在 `src/App.vue` 的 `textbooks` 常量中添加新条目：
   ```javascript
   import { data as newBook } from './data/new_book.js'
   
   const textbooks = [
     ...
     { id: 'new_id', name: '新教材名称', type: 'primary', data: newBook }
   ]
   ```

---

## 四、词性映射 (PosMap)

系统在 `App.vue` 中内置了 `posMap` 对象，自动将数据中的简写转换为更易读的中文说明：
- `n.` → `名词`
- `v.` → `动词`
- `adj.` → `形容词`
- ... 以及复杂的混合词性如 `adj./n.` → `形/名`。
