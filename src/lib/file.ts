import * as path from "path";
import * as fs from "fs";
import * as csvParse from "csv-parse";

export const readUTF8Text = (filename: string): string => {
    const BOM = Buffer.from("\uFEFF"); // EF BB BF
    let buffer: Buffer = fs.readFileSync(filename, { flag: 'r' });
    if (BOM.equals(buffer.slice(0, 3))) {
        // utf-8-sig
        buffer = buffer.slice(3);
    }
    return buffer.toString('utf-8');
};

export const readJSON = (filename: string): any => {
    return JSON.parse(readUTF8Text(filename));
};

export const readCSVAsync = (filename: string) => new Promise((resolve, reject) => {
    csvParse(readUTF8Text(filename), {
        comment: '#',
        delimiter: ',',
        escape: '\\'
    }, function (err, records, info) {
        if (err) {
            reject(err);
        } else {
            resolve(records);
        }
    });
});

export const formatFileSize = (fileSize: number): string => {
    const UNIT = ["B", "K", "M", "G", "T", "P"];
    const UNIT_SIZE = UNIT.length;
    const UNIT_STEP = 1024;
    let unitIndex = 0;
    while (fileSize >= UNIT_STEP && unitIndex < UNIT_SIZE - 1) {
        unitIndex++;
        fileSize /= UNIT_STEP;
    }
    return `${fileSize.toFixed(2)}${UNIT[unitIndex]}`;
};

export const getPureExtensionName = (fileName: string): string => {
    return path.extname(fileName).toLowerCase().substr(1);
};

export const moveFile = (originalName: string, newName: string, isDelete?: boolean) => {
    fs.createReadStream(originalName)
        .pipe(fs.createWriteStream(newName));
    if (undefined === isDelete || isDelete) {
        fs.unlinkSync(originalName);
    }
};