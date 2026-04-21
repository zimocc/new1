import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

/**
 * 读取指定目录下的 .xlsx 文件，并将其内容转换成和原需求一致的 JSON 格式数据
 * 每个 .xlsx 文件将单独生成一个同名的 .js 文件
 * @param {string} inputDir 指定的主目录
 * @param {string} outputDir 输出目录，未传则默认和 inputDir 相同
 */
export function processExcelFiles(inputDir, outputDir) {
    outputDir = outputDir || inputDir;
    // 获取指定目录下所有的 .xlsx 文件并按照顺序排序
    const files = fs.readdirSync(inputDir)
        .filter(file => file.endsWith('.xlsx') && !file.startsWith('~$'))
        .sort();

    for (const file of files) {
        let allLessonsMap = new Map();
        const filePath = path.join(inputDir, file);
        
        // 兼容 ES Module 导入情况
        const reader = xlsx.readFile || (xlsx.default && xlsx.default.readFile);
        const utils = xlsx.utils || (xlsx.default && xlsx.default.utils);
        
        if (!reader) {
            throw new Error("无法成功导入 xlsx 模块。");
        }

        const wb = reader(filePath);
        
        // 遍历文件中所有的 Sheet
        for (const sheetName of wb.SheetNames) {
            const sheet = wb.Sheets[sheetName];
            // 按照二维数组解构取出所有行
            const rows = utils.sheet_to_json(sheet, { header: 1 });
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                
                // 跳过表头
                if (row[0] === '章节' || String(row[0]).includes('章节')) {
                    continue;
                }
                
                let lessonVal = row[0];
                if (lessonVal === undefined || lessonVal === null) continue;
                
                // 提取章节编号
                let lessonStr = String(lessonVal).trim();
                const lessonMatch = lessonStr.match(/(\d+)/);
                const lessonNum = lessonMatch ? parseInt(lessonMatch[1], 10) : lessonStr;
                
                // 提取章节名称，过滤多余的中文
                let nameStr = row[1] || '';
                nameStr = String(nameStr).replace(/[\u4e00-\u9fa5].*$/, '').trim();

                // 提取具体的单词信息
                let word = String(row[2] || '').trim();
                let phoneticSymbol = String(row[3] || '').trim();
                let partSpeech = String(row[4] || '').trim();
                let cn = String(row[5] || '').trim();
                
                // 如果章节尚不存在字典中，则进行初始化
                if (!allLessonsMap.has(lessonNum)) {
                    allLessonsMap.set(lessonNum, {
                        unit: lessonNum,
                        name: nameStr,
                        words: []
                    });
                }
                
                // 如果当前行是有单词的，就压入属于它的章节中
                if (word && word !== '') {
                    allLessonsMap.get(lessonNum).words.push({
                        cn,
                        partSpeech,
                        phoneticSymbol,
                        word
                    });
                }
            }
        }

        // 转换为数组并重新按照章节数字排序
        const allLessons = Array.from(allLessonsMap.values()).sort((a,b) => {
            if (typeof a.lesson === 'number' && typeof b.lesson === 'number') {
                return a.lesson - b.lesson;
            }
            return 0;
        });

        // 格式化输出为 js 文件格式，并导出 data
        const outputFileName = file.replace(/\.xlsx$/, '.js');
        const outputFile = path.join(outputDir, outputFileName);
        const fileContent = `export const data = ${JSON.stringify(allLessons, null, 4)};\n\nexport default data;\n`;

        fs.writeFileSync(outputFile, fileContent, 'utf-8');
        console.log(`处理完成！${file} 共生成 ${allLessons.length} 个章节的数据，并输出至：${outputFile}`);
    }
}

// 自动执行转换方法 (读取 src/data 目录下的 xlsx，然后输出为同名的 js 文件)
const targetDir = path.resolve('src/data/generate-data');

try {
    processExcelFiles(targetDir);
} catch(err) {
    console.error("生成出错：", err);
}
