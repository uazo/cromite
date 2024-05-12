import { PredictionQueue as Queue } from "../queue/queue"

export class ImageFilter {
    private readonly MIN_IMAGE_SIZE: number
    private readonly queue: Queue

    constructor(queue: Queue) {
        this.MIN_IMAGE_SIZE = 41
        this.queue = queue
    }
    
    public analyzeImage(image: HTMLImageElement, srcAttribute: boolean): void {
        if (
            (srcAttribute || image.dataset.nsfwFilterStatus === undefined) &&
            image.src.length > 0 &&
            (
              (image.width > this.MIN_IMAGE_SIZE && image.height > this.MIN_IMAGE_SIZE) ||
              image.height === 0 ||
              image.width === 0
            )
        ) {
            image.dataset.nsfwFilterStatus = 'processing'
            if (image.complete || srcAttribute){
                this._analyzeImage(image)
            } else {
                image.onload = () => {
                    this._analyzeImage(image)
                }
	        }
        }
    }

    private _analyzeImage(image: HTMLImageElement): void {
	image.crossOrigin='anonymous'
        this.queue.predict(image, (result: boolean) => {
            image.style.transform = ""
            if (result){
                image.style.filter = 'blur(25px)'
            } else {
                image.style.filter = ""
            }
            image.crossOrigin = ""
        }, (error)=>{
            image.style.filter = "grayscale(1)"
            image.crossOrigin = ""
        })
    }
}
