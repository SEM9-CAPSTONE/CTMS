import "dotenv/config";
import { DataSource } from "typeorm";
import { dataSourceOptions } from "./typeorm.config";

export default new DataSource(dataSourceOptions);
