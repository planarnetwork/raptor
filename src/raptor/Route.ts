import { StopID } from "../gtfs/GTFS";

export class Route {

  constructor(
    private readonly routePath: StopID[], 
    private readonly startIndex: number
  ) {}
  
  public stops(): [StopID, number] {
    return ;
  }
}