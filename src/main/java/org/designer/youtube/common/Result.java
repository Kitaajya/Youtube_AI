package org.designer.youtube.common;
import lombok.Data;

@Data
public class Result<T> {
    private int code;
    private boolean success;
    private String message;
    private T data;
    public Result(int code,boolean success,String message,T data){
        this.code=code;
        this.success=success;
        this.message=message;
        this.data=data;
    }
    public static <T> Result<T> success() {
        return new Result<>(200, true, "操作成功", null);
    }
    public static <T> Result<T> success(T data) {
        return new Result<>(200, true, "操作成功", data);
    }
    public static <T> Result<T> success(String message, T data) {
        return new Result<>(200, true, message, data);
    }
    public static <T> Result<T> successMessage(String message) {
        return new Result<>(200, true, message, null);
    }
    public static <T> Result<T> fail(String message) {
        return new Result<>(400, false, message, null);
    }
    public static <T> Result<T> fail(int code, String message) {
        return new Result<>(code, false, message, null);
    }
}
