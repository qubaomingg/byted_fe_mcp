#!/usr/bin/env node
/**
 * This is a template MCP server that implements a simple notes system.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing notes as resources
 * - Reading individual notes
 * - Creating new notes via a tool
 * - Summarizing all notes via a prompt
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';
/**
 * Create an MCP server with capabilities for resources (to list/read notes),
 * tools (to create new notes), and prompts (to summarize notes).
 */
const server = new Server({
    name: "byted_fe_mcp",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {
            patterns: [
                ".*使用(okee|dprc|auxo).*创建.*",
                ".*如何使用(okee|dprc|auxo).*",
                ".*查找(okee|dprc|auxo)组件.*",
                ".*(okee|dprc|auxo).*组件怎么用.*"
            ]
        },
    },
});
/**
 * API 基础地址
 */
const API_PREFIX = 'bp-mcp';
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.life-data.cn';
// const API_BASE_URL = 'http://localhost:9000';
if (!API_BASE_URL) {
    throw new Error('API_BASE_URL environment variable is not defined');
}
/**
 * 组件库文档数据存储
 */
// 组件库文档数据存储
let LibraryDocs = {};
let isLibraryDocsLoading = false;
let loadLibraryDocPromise = null;
/**
 * 从接口加载组件库文档数据
 */
async function loadLibraryDoc() {
    if (isLibraryDocsLoading) {
        return loadLibraryDocPromise;
    }
    isLibraryDocsLoading = true;
    loadLibraryDocPromise = (async () => {
        try {
            // 1. 先获取所有组件库列表
            const response = await fetch(`${API_BASE_URL}/${API_PREFIX}/status`);
            const result = await response.json();
            const docs = {};
            // 2. 遍历每个组件库，获取其组件列表
            for (const collection of result.data.collections || []) {
                const componentsResponse = await fetch(`${API_BASE_URL}/${API_PREFIX}/components?repo=${collection.name}`);
                const componentsData = await componentsResponse.json();
                // 3. 构建组件库文档对象
                docs[collection.name] = {
                    id: collection.name,
                    components: (componentsData?.data?.data || []).map((item) => {
                        return {
                            name: item.id,
                            demo: item.metadata?.demo,
                        };
                    }),
                    introduce: `${collection?.metadata?.brief}`,
                };
            }
            LibraryDocs = docs;
        }
        catch (error) {
            console.error('Failed to load library docs:', error);
            LibraryDocs = {};
        }
    })();
    return loadLibraryDocPromise;
}
/**
 * Start the server using stdio transport.
 */
async function main() {
    // 移除 await loadLibraryDoc();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
/**
 * 修改 ListResourcesRequestSchema 处理器
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    await loadLibraryDoc();
    return {
        resources: Object.entries(LibraryDocs).map(([id, doc]) => ({
            uri: `component://${doc.id}`,
            mimeType: 'text/markdown',
            name: `${doc.id}`,
            describe: doc.introduce,
        })),
    };
});
/**
 * 修改 ReadResourceRequestSchema 处理器
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    await loadLibraryDoc();
    const url = new URL(request.params.uri);
    const library = url.hostname;
    const doc = LibraryDocs[library];
    if (!doc) {
        throw new Error(`Library ${library} not found`);
    }
    const content = `
    组件库: ${doc.id}
    组件列表: ${doc.components.map(component => component.name).join(', ')}
    简介: ${doc.introduce}
  `.trim();
    return {
        contents: [{
                uri: request.params.uri,
                mimeType: "text/markdown",
                text: content
            }]
    };
});
/**
 * 修改 ListToolsRequestSchema 处理器
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'search_component',
                description: '查找组件库使用',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: '搜索关键词',
                        },
                        repo: {
                            type: 'string',
                            description: '组件库名称（可选）',
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'search_components_multi',
                description: '使用多个关键词查找组件库使用',
                inputSchema: {
                    type: 'object',
                    properties: {
                        queries: {
                            type: 'array',
                            items: {
                                type: 'string',
                            },
                            description: '搜索关键词数组',
                        },
                        repo: {
                            type: 'string',
                            description: '组件库名称（可选）',
                        },
                    },
                    required: ['queries'],
                },
            },
            {
                name: 'list_library_components',
                description: '列出指定组件库的所有组件',
                inputSchema: {
                    type: 'object',
                    properties: {
                        library: {
                            type: 'string',
                            description: '组件库名称（如 dprc, okee, auxo）',
                        },
                    },
                    required: ['library'],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
        case "search_component": {
            const query = String(request.params.arguments?.query);
            const repo = request.params.arguments?.repo;
            if (!query) {
                throw new Error('Search query is required');
            }
            try {
                let url = `${API_BASE_URL}/${API_PREFIX}/search?q=${encodeURIComponent(query)}`;
                if (repo) {
                    url += `&repo=${encodeURIComponent(repo)}`;
                }
                const response = await fetch(url);
                const results = await response.json();
                if (!results?.data?.results?.length) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: '未找到相关组件',
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                throw new Error(`Search failed: ${error}`);
            }
        }
        // 同样修改 search_components_multi 中的处理
        case "search_components_multi": {
            const queries = request.params.arguments?.queries;
            const repo = request.params.arguments?.repo;
            if (!queries || !Array.isArray(queries) || queries.length === 0) {
                throw new Error("Search queries array is required");
            }
            try {
                // 构建多个 q 参数的 URL
                let url = `${API_BASE_URL}/${API_PREFIX}/search/multi?${queries
                    .map((q) => `q=${encodeURIComponent(q)}`)
                    .join('&')}`;
                // 添加 repo 参数
                if (repo) {
                    url += `&repo=${encodeURIComponent(repo)}`;
                }
                const response = await fetch(url);
                const results = await response.json();
                // 如果没有搜索结果，返回空内容
                if (!results?.data?.results?.length) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: '未找到相关组件',
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                throw new Error(`Multi-search failed: ${error}`);
            }
        }
        case "list_library_components": {
            const library = String(request.params.arguments?.library);
            if (!library) {
                throw new Error("Library name is required");
            }
            const doc = LibraryDocs[library];
            if (!doc) {
                return {
                    content: [{
                            type: "text",
                            text: `未找到组件库 ${library} 的相关组件`
                        }]
                };
            }
            console.error(doc);
            console.error('------------');
            const components = doc.components.map(component => ({
                name: component.name,
                demo: component.demo,
                library: doc.id,
            }));
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(components, null, 2)
                    }]
            };
        }
        default:
            throw new Error("Unknown tool");
    }
});
// 更新处理器的类型
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    // 获取所有组件库名称
    const libraries = Object.keys(LibraryDocs);
    return {
        prompts: libraries.map(library => ({
            name: `${library}`,
            description: `查询 ${library} 组件库的组件使用方法`,
            patterns: [
                // 基础使用场景
                `.*使用${library}.*创建.*`,
                `.*如何使用${library}.*`,
                `.*${library}.*怎么用.*`,
                // 查找和搜索场景
                `.*查找${library}.*组件.*`,
                `.*搜索${library}.*组件.*`,
                `.*${library}.*有哪些.*组件.*`,
                // 具体功能场景
                `.*${library}.*实现.*功能.*`,
                `.*${library}.*开发.*`,
                // 示例和文档场景
                `.*${library}.*示例.*`,
                `.*${library}.*文档.*`,
                // 问题和错误场景
                `.*${library}.*报错.*`,
                `.*${library}.*问题.*`
            ]
        }))
    };
});
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = (request?.params?.name).toLowerCase();
    const library = prompt.includes('okee') ? 'okee' : 'dprc';
    const doc = LibraryDocs[library];
    if (!doc) {
        throw new Error(`Library ${library} not found`);
    }
    // 构建组件信息消息
    const componentMessages = doc.components.map(component => ({
        role: "user",
        content: {
            type: "text",
            text: `${component.name}`
        }
    }));
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `请为我介绍以下 ${library} 组件库的组件：`
                }
            },
            ...componentMessages,
            {
                role: "assistant",
                content: {
                    type: "text",
                    text: `以上是所有可用的 ${library} 组件，您可以根据需要选择合适的组件使用。\n组件库简介：${doc.introduce}`
                }
            }
        ]
    };
});
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
