import {TransferPatternIndex} from "./PatternStringGenerator";
import {Pool} from "mysql";

/**
 * Access to the transfer_patterns and last_transfer_pattern_scan tables
 */
export class TransferPatternRepository {

  constructor(
    private readonly db: Pool
  ) { }

  /**
   * Store every transfer pattern in the tree
   */
  public async storeTransferPatterns(patterns: TransferPatternIndex): Promise<void> {
    const journeys: object[] = [];

    for (const journey in patterns) {
      for (const pattern of patterns[journey]) {
        journeys.push([journey, pattern]);
      }
    }

    if (journeys.length > 0) {
      try {
        await this.db.query("INSERT IGNORE INTO transfer_patterns VALUES ?", [journeys]);
      }
      catch (err) {
        console.error(err);
      }
    }
  }
}