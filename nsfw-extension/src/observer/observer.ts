import { ImageFilter } from "../filter/ImageFilter"
import { VideoFilter } from "../filter/VideoFilter"
import { PredictionQueue as Queue } from "../queue/queue"

export class DomObserver {
    private readonly observer: MutationObserver
    private readonly imageFilter: ImageFilter
    private readonly videoFilter: VideoFilter

    private running: boolean;

    constructor(queue: Queue){
        this.imageFilter = new ImageFilter(queue)
        this.videoFilter = new VideoFilter(queue)
        this.observer = new MutationObserver(this.callback.bind(this))
        this.running = false;
    }

    public watch (): void {
      if (this.running){
        return;
      }
      // Existing elements;
      const images = document.getElementsByTagName('img')
      for (let i = 0; i < images.length; i++) {
        this.imageFilter.analyzeImage(images[i], false)
      }
  
      const videos = document.getElementsByTagName('video')
      for (let i = 0; i < videos.length; i++){
        this.videoFilter.analyzeVideo(videos[i] as HTMLVideoElement);
      }
      // Watch for mutations
      this.observer.observe(document, DomObserver.getConfig())
      this.running = true;
    }

    public stop(): void {
      if (!this.running){
        return;
      }
      this.observer.disconnect();
      this.running = false;
    }

    private callback (mutationsList: MutationRecord[]): void {
        for (let i = 0; i < mutationsList.length; i++) {
          const mutation = mutationsList[i]
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            this.findAndChecksAllTags(mutation.target as Element)
          } else if (mutation.type === 'attributes') {
            this.checkAttributeMutation(mutation)
          }
        }
    }

    private findAndChecksAllTags(element: Element): void {
        const images = element.getElementsByTagName('img')
        for (let i = 0; i < images.length; i++) {
          this.imageFilter.analyzeImage(images[i], false)
        }
    
        const videos = element.getElementsByTagName('video')
        for (let i = 0; i < videos.length; i++){
          this.videoFilter.analyzeVideo(videos[i] as HTMLVideoElement);
        }
    }

    private checkAttributeMutation (mutation: MutationRecord): void {
        if ((mutation.target as HTMLImageElement).nodeName === 'IMG') {
          this.imageFilter.analyzeImage(mutation.target as HTMLImageElement, mutation.attributeName === 'src')
        }
        if ((mutation.target as HTMLVideoElement).nodeName === 'VIDEO') {
          this.videoFilter.analyzeVideo(mutation.target as HTMLVideoElement)
        }
      }

    private static getConfig (): MutationObserverInit {
        return {
          characterData: false,
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['src']
        }
    }
}
