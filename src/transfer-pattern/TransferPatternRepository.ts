import {TransferPatternIndex} from "./results/StringResults";
import {Pool} from "mysql2/promise";

/**
 * Access to the transfer_patterns table in a mysql compatible database
 */
export class TransferPatternRepository {

  constructor(
    private readonly db: Pool
  ) { }

  /**
   * Store every transfer pattern in the tree
   */
  public async storeTransferPatterns(patterns: TransferPatternIndex): Promise<void> {
    const journeys: unknown[] = [];

    for (const journey in patterns) {
      for (const pattern of patterns[journey]) {
        journeys.push([journey, pattern]);
      }
    }

    if (journeys.length > 0) {
      await this.retryQuery("INSERT IGNORE INTO transfer_patterns VALUES ?", [journeys]);
    }
  }

  private async retryQuery(sql: string, data: unknown[], numRetries: number = 3) {
    try {
      await this.db.query(sql, data);
    }
    catch (err) {
      if (numRetries > 0) {
        await this.retryQuery(sql, data, numRetries - 1);
      }
      else {
        console.error(err);
      }
    }

  }

  /**
   * Create the transfer pattern table if it does not already exist
   */
  public async initTables(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS transfer_patterns (
        journey char(6) NOT NULL,
        pattern varchar(255) NOT NULL,
        PRIMARY KEY (journey,pattern)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
     `
    );
  }
}
