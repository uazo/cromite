import { Model } from '../model/model'
import Queue from "queue-promise";

export class PredictionQueue{
  private model: Model
  private queue: Queue
  constructor (model: Model) {
    this.model = model
    this.queue = new Queue({
      concurrent: 1,
      interval: 0
    })
  }
  public predict(img: HTMLImageElement | ImageData, resolve: (result: boolean) => void, reject: (error: Error) => void): void{
    this.queue.add(()=>{
      return this.model.predictImage(img).then(resolve).catch(reject)
    });
  }
}
