import * as fs from "fs";

export const readJSON = (filename: string): any => {
    const text = fs.readFileSync(filename, {encoding: 'utf-8', flag: 'r'});
    return JSON.parse(text);
}
