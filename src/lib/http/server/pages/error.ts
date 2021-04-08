import { ServerResponse } from "http";
import { errorMessage } from "../base";

export const error403 = (res: ServerResponse) => errorMessage(res, 403, "Forbidden!");
export const error404 = (res: ServerResponse) => errorMessage(res, 404, "Not Found!");
export const error500 = (res: ServerResponse) => errorMessage(res, 500, "Internal Server Error!");
