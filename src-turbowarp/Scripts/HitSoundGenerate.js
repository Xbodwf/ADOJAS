// Name: BeatSplicer
// ID: beatSplicer
// Description: 根据时间点拼接打拍音
// By: Xbodw
// License: MIT

(function(Scratch) {
  'use strict';

  // 确保AudioContext兼容性
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let audioContext;

  class BeatSplicer {
    getInfo() {
      return {
        id: 'beatSplicer',
        name: '打拍音拼接',
        color1: '#4A90E2',
        blocks: [
          {
            opcode: 'spliceBeats',
            blockType: Scratch.BlockType.REPORTER,
            text: '根据时间点 [TIMES] 拼接打拍音 [BEAT] 采样率 [SAMPLERATE]',
            arguments: {
              TIMES: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: '[0.0,1.0,2.0,3.0,4.0]'
              },
              BEAT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'data:audio/wav;base64,...'
              },
              // 新增采样率参数，默认值为0（表示使用输入音频采样率）
              SAMPLERATE: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              }
            }
          }
        ]
      };
    }

    spliceBeats(args) {
      return new Promise((resolve, reject) => {
        try {
          // 初始化AudioContext
          if (!audioContext) {
            audioContext = new AudioContext();
          }

          // 解析时间点字符串为数组
          const timeStrings = JSON.parse(args.TIMES);
          const timePoints = timeStrings.map(time => parseFloat(time));

          // 检查时间点是否有效
          if (timePoints.some(isNaN)) {
            throw new Error('无效的时间点格式');
          }

          // 解析打拍音DataURL
          const beatDataURL = args.BEAT;
          const arrayBuffer = this.dataURLToArrayBuffer(beatDataURL);

          // 解码音频数据
          audioContext.decodeAudioData(arrayBuffer)
            .then(originalBuffer => {
              // 确定目标采样率：若用户输入0则使用原始采样率，否则使用用户指定值（限制范围）
              const targetSampleRate = args.SAMPLERATE === 0 
                ? originalBuffer.sampleRate 
                : Math.max(8000, Math.min(96000, Math.round(args.SAMPLERATE)));

              // 重采样（如果需要）
              let processedBuffer = originalBuffer;
              if (originalBuffer.sampleRate !== targetSampleRate) {
                processedBuffer = this.resampleAudioBuffer(originalBuffer, targetSampleRate);
              }

              // 计算输出音频的总长度（基于目标采样率）
              const maxTime = timePoints.reduce((max, t) => Math.max(max, t), 0);
              const totalDuration = maxTime + processedBuffer.duration;
              const totalFrames = Math.round(totalDuration * targetSampleRate);

              // 创建输出音频缓冲区（使用目标采样率）
              const outputBuffer = audioContext.createBuffer(
                processedBuffer.numberOfChannels,
                totalFrames,
                targetSampleRate
              );

              // 填充输出缓冲区
              for (let ch = 0; ch < outputBuffer.numberOfChannels; ch++) {
                const outputData = outputBuffer.getChannelData(ch);
                outputData.fill(0); // 初始化为静音

                // 在每个时间点插入打拍音（基于目标采样率计算帧位置）
                timePoints.forEach(time => {
                  const startFrame = Math.round(time * targetSampleRate);
                  const sourceData = processedBuffer.getChannelData(ch);
                  
                  for (let i = 0; i < sourceData.length; i++) {
                    if (startFrame + i < totalFrames) {
                      outputData[startFrame + i] += sourceData[i]; // 叠加音频
                    }
                  }
                });
              }

              // 转换为WAV格式并生成DataURL
              const wavBlob = this.bufferToWav(outputBuffer);
              const reader = new FileReader();
              
              reader.onloadend = () => {
                resolve(reader.result);
              };
              
              reader.onerror = () => {
                throw new Error('无法生成音频DataURL');
              };
              
              reader.readAsDataURL(wavBlob);
            })
            .catch(err => {
              console.error('解码音频失败:', err);
              reject('解码音频失败');
            });
        } catch (error) {
          console.error('打拍音拼接扩展错误:', error);
          resolve('data:audio/wav;base64,'); // 返回空音频
        }
      });
    }

    // 新增：音频重采样方法（线性插值）
    resampleAudioBuffer(buffer, targetSampleRate) {
      const sourceSampleRate = buffer.sampleRate;
      const numChannels = buffer.numberOfChannels;
      const targetLength = Math.round(buffer.length * targetSampleRate / sourceSampleRate);
      
      const resampledBuffer = audioContext.createBuffer(
        numChannels,
        targetLength,
        targetSampleRate
      );
      
      for (let ch = 0; ch < numChannels; ch++) {
        const sourceData = buffer.getChannelData(ch);
        const targetData = resampledBuffer.getChannelData(ch);
        
        for (let i = 0; i < targetLength; i++) {
          const sourceIndex = i * sourceSampleRate / targetSampleRate;
          const indexFloor = Math.floor(sourceIndex);
          const indexCeil = Math.ceil(sourceIndex);
          
          if (indexCeil >= sourceData.length) {
            targetData[i] = 0;
          } else if (indexFloor === indexCeil) {
            targetData[i] = sourceData[indexFloor];
          } else {
            // 线性插值计算采样值
            const ratio = sourceIndex - indexFloor;
            targetData[i] = sourceData[indexFloor] * (1 - ratio) + sourceData[indexCeil] * ratio;
          }
        }
      }
      
      return resampledBuffer;
    }

    // 以下方法与原文件相同，未做修改
    dataURLToArrayBuffer(dataURL) {
      const parts = dataURL.split(',');
      const byteCharacters = atob(parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      return new Uint8Array(byteNumbers).buffer;
    }

    bufferToWav(audioBuffer) {
      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1; // PCM
      const bitDepth = 16; // 16位
      
      let interleaved;
      if (numChannels === 1) {
        interleaved = audioBuffer.getChannelData(0);
      } else {
        interleaved = this.interleaveChannels(
          audioBuffer.getChannelData(0),
          audioBuffer.getChannelData(1)
        );
      }
      
      const dataLength = interleaved.length * 2;
      const bufferLength = 44 + dataLength;
      const view = new DataView(new ArrayBuffer(bufferLength));
      
      this.writeWavHeader(view, numChannels, sampleRate, dataLength);
      
      const offset = 44;
      for (let i = 0; i < interleaved.length; i++) {
        const sample = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset + i * 2, sample * 32767, true);
      }
      
      return new Blob([view], { type: 'audio/wav' });
    }

    interleaveChannels(leftChannel, rightChannel) {
      const length = leftChannel.length + rightChannel.length;
      const result = new Float32Array(length);
      let index = 0;
      
      for (let i = 0; i < leftChannel.length; i++) {
        result[index++] = leftChannel[i];
        result[index++] = rightChannel[i];
      }
      
      return result;
    }

    writeWavHeader(view, numChannels, sampleRate, dataLength) {
      this.writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      this.writeString(view, 8, 'WAVE');
      
      this.writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * 2, true);
      view.setUint16(32, numChannels * 2, true);
      view.setUint16(34, 16, true);
      
      this.writeString(view, 36, 'data');
      view.setUint32(40, dataLength, true);
    }

    writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  }

  Scratch.extensions.register(new BeatSplicer());
})(Scratch);