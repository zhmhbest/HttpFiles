import * as path from "path";
import * as fs from "fs";

export const readJSON = (filename: string): any => {
    const text = fs.readFileSync(filename, {encoding: 'utf-8', flag: 'r'});
    return JSON.parse(text);
};

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
    if(undefined === isDelete || isDelete) {
        fs.unlinkSync(originalName);
    }
};