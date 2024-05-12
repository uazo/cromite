import { load as loadModel} from 'nsfwjs'
import { DomObserver } from './observer/observer';
import { Model } from './model/model';
import { PredictionQueue as Queue } from './queue/queue'

function domReady(cb: Function): void {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        cb();
    } else {
        document.addEventListener("DOMContentLoaded", (event: Event) => {
            cb();
        });
    }
}

loadModel('https://raw.githubusercontent.com/elb3k/nsfw-chromium/main/models/mobilenet_v2/').then(nsfwModel => {
    domReady(()=>{
        let model = new Model(nsfwModel, {filterStrictness: 80});
        let queue = new Queue(model);
        let observer = new DomObserver(queue);
        observer.watch();
    })
}).catch((error) => {
    console.log("failed to load model: ", error)
});