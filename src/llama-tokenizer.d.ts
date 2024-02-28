declare module 'llama-tokenizer-js' {
    declare namespace LlamaTokenizer {
        function encode(prompt: string, add_bos_token?: boolean, add_preceding_space?: boolean, log_performance?: boolean): number[] | undefined;
        function decode(tokens: number[], add_bos_token?: boolean, add_preceding_space?: boolean): string;
    }
    export default LlamaTokenizer;
}
