import { PredictionQueue as Queue } from "../queue/queue"

export class VideoFilter {
    private readonly MIN_IMAGE_SIZE: number
    private readonly queue: Queue

    constructor(queue: Queue) {
        this.MIN_IMAGE_SIZE = 41
        this.queue = queue
    }

    public analyzeVideo(video: HTMLVideoElement, ): void {
        if (
            (video.dataset.nsfwAnalysis === undefined) &&
            (
              (video.width > this.MIN_IMAGE_SIZE && video.height > this.MIN_IMAGE_SIZE) ||
              video.height === 0 ||
              video.width === 0
            )
          ) {
            this._startVideoAnalysis(video);
          }
    }

    private _startVideoAnalysis(video: HTMLVideoElement): void {
        video.dataset.nsfwAnalysis = "analyzing"
        const canvas = document.createElement('canvas');
        canvas.width = 224;
        canvas.height = 224;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
  
        let ts = Date.now();
        const frameHandler = () => {
          // Update only once a second
          const now = Date.now()
          if (now - ts < 1000) {
            video.requestVideoFrameCallback(frameHandler); 
            return
          }
          ts = now;
  
          // Run image detection
          const img = this._getImageFromVideo(video, canvas, ctx);
          if (img !== undefined){
            this.queue.predict(img, (result: boolean) => {
              if(result){
                  this._blurVideo(video);
              } else {
                  this._unblurVideo(video);
              }
            }, (error: Error) =>{})
          }
          video.requestVideoFrameCallback(frameHandler);
        }
        video.requestVideoFrameCallback(frameHandler);
      }
  
      private _getImageFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D | null) {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          return ctx?.getImageData(0, 0, canvas.width, canvas.height);
      }
  
      private _blurVideo(video: HTMLVideoElement): void {
          video.style.filter = 'blur(25px)'
      }
  
      private _unblurVideo(video: HTMLVideoElement): void {
          video.style.filter = "";
      }
}