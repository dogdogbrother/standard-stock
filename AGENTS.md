## 项目简介
本项目是移动端项目

## 样式
能用到vant-ui的都使用vant-ui

## 数据库
用的supabase

## 股票数据api

- 获取股票列表,可以用来搜索用
  - 原始接口: https://proxy.finance.qq.com/ifzqgtimg/appstock/smartbox/search/get
  - 由于跨域限制,通过 Supabase Edge Function 代理访问
  - 参数`q`,值可以是股票代码,也可以是拼音缩写,也可以是汉字.
  - 返回的数据结构如下:
```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "sector": [],
      "manager": [],
      "stock": [
          [
              "sh",
              "601689",
              "拓普集团",
              "",
              "GP-A"
          ],
          [
              "sz",
              "002233",
              "塔牌集团",
              "",
              "GP-A"
          ]
      ],
    }
  }
```
  - GP-A是股票的意思,我们只看GP-A的数据.
  - Edge Function 位于 `supabase/functions/stock-search/`
    