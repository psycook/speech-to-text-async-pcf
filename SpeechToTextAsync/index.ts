import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export class SpeechToTextAsync implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private _notifyOutputChanged: () => void;

    // component attributes
    private _context: ComponentFramework.Context<IInputs>;
    private _container: HTMLDivElement;
    private _buttonDiv: HTMLDivElement;
    private _isInitiated: boolean = false;
    private _isInListenMode: boolean = false;

    // component attributes
    private _subscriptionKey: string;
    private _region: string;
    private _sourceLanguage: string;
    private _targetLanguage: string;
    private _strokeColor: string = "black";

    // output attributes
    private _state: string = "idle"; // idle|listening|recognising|recognised|complete
    private _sourceText: string = "";
    private _translatedText: string = "";
    private _spokenRecognisingText: string = "";
    private _translatedRecognisingText: string = "";
    private _errorText: string = "";

    // size
    private _previousWidth: number = 0;
    private _previewHeight: number = 0;

    // speech sdk
    private _recognizer: SpeechSDK.TranslationRecognizer | undefined;

    constructor() {
    }

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        // save the context
        this._context = context;
        this._context.mode.trackContainerResize(true);

        // save the notifyOutputChanged
        this._notifyOutputChanged = notifyOutputChanged;

        // Add control initialization code
        this._container = container;

        // set default values
        this._state = "idle";
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        //console.log(`updateView: called`);
        this.updateStateFromContext(context);
    }

    public getOutputs(): IOutputs {
        console.log(`Returning outputs: translatedText: ${this._translatedText}, sourceText: ${this._sourceText} sourceRecognisingText: ${this._spokenRecognisingText}, translatedRecognisingText: ${this._translatedRecognisingText}`);

        return {
            "state": this._state,
            "spokenText": this._sourceText,
            "translatedText": this._translatedText,
            "spokenRecognisingText": this._spokenRecognisingText,
            "translatedRecognisingText": this._translatedRecognisingText,
            "errorText": this._errorText
        };
    }

    public destroy(): void {
        // Add code to cleanup control if necessary
    }

    public updateStateFromContext(context: ComponentFramework.Context<IInputs>): void {
        this._subscriptionKey = context.parameters.subscriptionKey.raw as string;
        this._region = context.parameters.region.raw as string;
        this._sourceLanguage = context.parameters.sourceLanguage.raw as string;
        this._targetLanguage = context.parameters.targetLanguage.raw as string;
        this._state = context.parameters.state.raw as string;
        const strokeColor = context.parameters.strokeColor.raw as string;

        if (strokeColor != undefined || strokeColor != "" || strokeColor != null) {
            this._strokeColor = strokeColor;
        }

        if (!this._isInitiated) {
            console.log(`updateStateFromContext: initiating control, stroke color is ${this._strokeColor}`);
            // create the translation div & button
            this._buttonDiv = document.createElement("div");
            this._buttonDiv.id = `button-div`;
            this._buttonDiv.className = `button-div`;
            this._buttonDiv.style.width = `100%`;
            this._buttonDiv.style.height = `100%`;
            this._buttonDiv.style.cursor = `pointer`;
            this.setMicButton();
            this._buttonDiv.addEventListener('click', this.onClick.bind(this));
            this._container.appendChild(this._buttonDiv);
            // set the initialised state to true
            this._isInitiated = true;
        } else {

            if(this._previousWidth != this._context.mode.allocatedWidth || this._previewHeight != this._context.mode.allocatedHeight) {
                console.log(`updateStateFromContext: resizing control, stroke color is ${this._strokeColor}`);
                this._previousWidth = this._context.mode.allocatedWidth;
                this._previewHeight = this._context.mode.allocatedHeight;
                if(this._isInListenMode) {
                    this.setListeningButton();
                } else {
                    this.setMicButton();
                }
            }
        }
    }

    public onClick(): void {
        if (this._isInListenMode) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    public startListening(): void {
        console.log(`Recognising: start listening: ${this._sourceLanguage} -> ${this._targetLanguage}`);

        // reset the text values
        this._sourceText = "";
        this._translatedText = "";
        this._spokenRecognisingText = "";
        this._translatedRecognisingText = "";

        // create the speech recogniser
        var speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(this._subscriptionKey, this._region);
        let audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

        // configure the languages
        speechConfig.speechRecognitionLanguage = this._sourceLanguage;
        speechConfig.addTargetLanguage(this._targetLanguage);

        // create the speech recogniser
        this._recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);
        this._recognizer.recognizing = this.recognising.bind(this);
        this._recognizer.recognized = this.recognised.bind(this);
        this._recognizer.sessionStopped = this.sessionStopped.bind(this);

        // start the speech recogniser
        this._recognizer.startContinuousRecognitionAsync();
        this._isInListenMode = true;

        // update the UI components
        this.startListeningUpdateUIComponents();
        this._notifyOutputChanged();

    }

    public recognising(sender: SpeechSDK.TranslationRecognizer, event: SpeechSDK.TranslationRecognitionEventArgs): void {
        var text = event.result.text;
        var translatedText = event.result.translations.get(this._targetLanguage.split("-")[0]);

        this._state = "recognising";
        this._spokenRecognisingText = (text != undefined ? text : "");
        this._translatedRecognisingText = (translatedText != undefined ? translatedText : "");
        console.log(`Recognising: ${this._spokenRecognisingText}`);
        console.log(`Recognising: ${this._translatedRecognisingText}}`);
        this._notifyOutputChanged();
    }

    public recognised(sender: SpeechSDK.TranslationRecognizer, event: SpeechSDK.TranslationRecognitionEventArgs): void {
        var text = event.result.text;
        var translatedText = event.result.translations.get(this._targetLanguage.split("-")[0]);
        
        this._state = "recognised";
        this._sourceText += (text != undefined ? text : "") + " ";
        this._translatedText += (translatedText != undefined ? translatedText :  "" )+ " ";
        console.log(`Recognised: ${this._sourceText}`);
        console.log(`Recognised: ${this._translatedText}`);
        this._notifyOutputChanged();
    }

    public sessionStopped(sender: SpeechSDK.Recognizer, event: SpeechSDK.SessionEventArgs): void {
        this.stopListening();
    }

    public stopListening(): void {
        if (this._recognizer != undefined) {
            this._spokenRecognisingText = "";
            this._translatedRecognisingText = "";
            this._recognizer.stopContinuousRecognitionAsync();
            this.stopListeningUpdateUIComponents();
            this._notifyOutputChanged();
        }
    }

    public startListeningUpdateUIComponents() {
        this.setListeningButton();
        this._state = 'listening';
        this._isInListenMode = true;
    }

    public stopListeningUpdateUIComponents() {
        this.setMicButton();
        this._state = "complete";
        this._isInListenMode = false;
    }


    public setListeningButton() 
    {
        this._buttonDiv.innerHTML = `<svg width='${this._context.mode.allocatedWidth}' height='${this._context.mode.allocatedHeight}' viewBox='0 0 800 800' fill='none' xmlns='http://www.w3.org/2000/svg'> <rect x="338" y="300" width="30" height="200" fill="${this._strokeColor}"/> <rect x="433" y="300" width="30" height="200" fill="${this._strokeColor}"/> <g> <path d='M400 700C234.315 700 100 565.685 100 400' stroke='${this._strokeColor}' stroke-width='12' /> <animateTransform attributeType='xml' attributeName='transform' type='rotate' from='0 400 400' to='360 400 400' dur='2s' additive='sum' repeatCount='indefinite' /> </g> </svg>`; 
    }

    public setMicButton()
    {
        this._buttonDiv.innerHTML = `<svg width='${this._context.mode.allocatedWidth}' height='${this._context.mode.allocatedHeight}' viewBox='0 0 800 800' fill='none' xmlns='http://www.w3.org/2000/svg'> <circle cx='400' cy='400' r='294' stroke='${this._strokeColor}' stroke-width='12'/> <path d='M334.148 380.377V265.182C334.148 229.185 363.329 200 399.331 200H400.646C436.644 200 465.828 229.181 465.828 265.182V380.377C465.828 416.375 436.647 445.559 400.646 445.559H399.331C363.333 445.559 334.148 416.378 334.148 380.377ZM480.784 460.515C502.189 439.11 513.977 410.648 513.977 380.377C513.977 373.699 508.563 368.285 501.884 368.285C495.206 368.285 489.792 373.699 489.792 380.377C489.792 404.188 480.519 426.574 463.681 443.412C446.843 460.25 424.457 469.523 400.646 469.523H399.331C375.52 469.523 353.134 460.25 336.296 443.412C319.458 426.574 310.185 404.188 310.185 380.377C310.185 373.699 304.771 368.285 298.092 368.285C291.414 368.285 286 373.699 286 380.377C286 410.648 297.787 439.11 319.193 460.515C337.88 479.202 361.945 490.557 387.896 493.141V575.815H334.152C327.473 575.815 322.059 581.229 322.059 587.908C322.059 594.586 327.473 600 334.152 600H465.832C472.51 600 477.924 594.586 477.924 587.908C477.924 581.229 472.51 575.815 465.832 575.815H412.088V493.141C438.039 490.557 462.104 479.202 480.791 460.515H480.784Z' fill='${this._strokeColor}'/> </svg> `;
    }

}