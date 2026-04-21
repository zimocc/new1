import fs from 'fs';
import path from 'path';

/**
 * 读取指定目录下的 .csv 文件，并将其内容转换成 JSON 格式的数据
 * @param {string} inputDir 指定的主目录
 * @param {string} outputFile 输出数据的目标 JS 文件路径
 */
export function processCsvFiles(inputDir, outputFile) {
    // 获取指定目录下所有的 .csv 文件并按照顺序排序
    const files = fs.readdirSync(inputDir)
        .filter(file => file.endsWith('.csv'))
        .sort();

    let allLessons = [];

    for (const file of files) {
        const filePath = path.join(inputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 按照换行符进行分割
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        
        let currentLesson = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            // 跳过表头
            if (i === 0 && line.includes('章节')) {
                continue;
            }

            // 数据至少包含这几列：章节，名称，单词，音标，词性，中文意思
            // 取最后四列为单词属性，避免因为章节名称中存在逗号而分割错误
            const parts = line.split(',');
            if (parts.length < 5) continue;

            const cn = parts.pop().trim();
            const partSpeech = parts.pop().trim();
            const phoneticSymbol = parts.pop().trim();
            const word = parts.pop().trim();

            const prefix = parts.join(',').trim();

            // 如果有前缀信息，则说明是一个新的章节（或者存在前缀为空的单词行）
            if (prefix && prefix !== ',') {
                const firstCommaIndex = prefix.indexOf(',');
                let lessonStr = '';
                let nameStr = '';
                
                if (firstCommaIndex !== -1) {
                    lessonStr = prefix.substring(0, firstCommaIndex).trim();
                    nameStr = prefix.substring(firstCommaIndex + 1).trim();
                } else {
                    lessonStr = prefix;
                }

                if (lessonStr.toLowerCase().startsWith('lesson')) {
                    const lessonMatch = lessonStr.match(/(\d+)/);
                    const lessonNum = lessonMatch ? parseInt(lessonMatch[1], 10) : lessonStr;

                    // 过滤掉名称中的中文翻译，按照示例格式保留纯英文名称
                    nameStr = nameStr.replace(/[\u4e00-\u9fa5].*$/, '').trim();

                    currentLesson = {
                        lesson: lessonNum,
                        name: nameStr,
                        words: []
                    };
                    allLessons.push(currentLesson);
                }
            }

            // 如果当前行存在合法的单词数据，则挂载到当前章节下
            // 如果单词为空，说明是“有的章节没有单词”，这里由于 words 默认为 []，不 push 即可
            if (word && currentLesson) {
                currentLesson.words.push({
                    cn,
                    partSpeech,
                    phoneticSymbol,
                    word
                });
            }
        }
    }

    // 格式化输出为 js 文件格式，并导出 data
    const fileContent = `export const data = ${JSON.stringify(allLessons, null, 4)};\n\nexport default data;\n`;

    fs.writeFileSync(outputFile, fileContent, 'utf-8');
    console.log(`处理完成！共生成 ${allLessons.length} 个章节的数据，并输出至：${outputFile}`);
}

// 自动执行转换方法 (读取 src/data 目录下的 csv，然后输出为 index.js )
const targetDir = path.resolve('src/data');
const outPath = path.resolve('src/data/wordsData.js');

try {
    processCsvFiles(targetDir, outPath);
} catch(err) {
    console.error("生成出错：", err);
}
